import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { TestResult } from "@/lib/models/TestResult";
import { PracticeAttempt } from "@/lib/models/PracticeAttempt";
import { getSessionUserId } from "@/lib/auth/session";
import { getTranscriptionModelName, transcribeAudio, TranscriptionError } from "@/lib/ielts/transcribe";
import {
  evaluateTranscript,
  evaluateTranscriptStreaming,
  getAiProvider,
  getEvaluationModelName,
  SPEAKING_PROMPT_VERSION,
} from "@/lib/ielts/evaluate";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/request-guards";

/** Allow long transcription + LLM calls on serverless hosts */
export const maxDuration = 120;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MIN_RECORDING_SECONDS = 30;
const MAX_RECORDING_SECONDS = 5 * 60;

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getRetryDelaySeconds(message: string): number | null {
  const retryDelay = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelay?.[1]) return Number(retryDelay[1]);

  const retryIn = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (retryIn?.[1]) return Math.ceil(Number(retryIn[1]));

  return null;
}

function getAiUserMessage(e: unknown, fallback: string): string {
  const message = getErrorMessage(e);
  if (message.includes("429 Too Many Requests") || message.toLowerCase().includes("quota")) {
    const retryDelay = getRetryDelaySeconds(message);
    return retryDelay
      ? `Gemini quota is temporarily exhausted. Wait about ${retryDelay} seconds, then try again.`
      : "Gemini quota is exhausted for this API key/project. Try a fresh Google AI Studio key, wait for quota reset, or enable billing.";
  }
  if (message.toLowerCase().includes("api key")) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local, then restart the dev server.";
  }
  return fallback;
}

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`analyze:${userId}:${getClientIp(req)}`, {
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an audio field" },
      { status: 400 }
    );
  }

  const started = performance.now();
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing audio blob" }, { status: 400 });
  }

  const durationSeconds = Number(form.get("durationSeconds"));
  if (!Number.isFinite(durationSeconds)) {
    return NextResponse.json(
      { error: "Missing recording duration. Please record again before submitting." },
      { status: 400 }
    );
  }
  if (durationSeconds < MIN_RECORDING_SECONDS) {
    return NextResponse.json(
      { error: "Recording is too short. Please record at least 30 seconds." },
      { status: 400 }
    );
  }
  if (durationSeconds > MAX_RECORDING_SECONDS) {
    return NextResponse.json(
      { error: "Recording is too long. Please keep your answer under 5 minutes." },
      { status: 400 }
    );
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording is too large. Please keep your answer under 5 minutes." },
      { status: 413 }
    );
  }

  /** Prefer compressed audio from the client to reduce upload + transcription time */
  const mime = file.type || "audio/webm";
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename =
    mime.includes("ogg")
      ? "speech.ogg"
      : mime.includes("mp4") || mime.includes("aac")
        ? "speech.m4a"
        : mime.includes("webm")
          ? "speech.webm"
          : "speech.bin";

  let transcript: string;
  try {
    transcript = await transcribeAudio({ buffer, filename, mimeType: mime });
  } catch (e) {
    console.error("[exam/analyze] transcription failed:", e);
    if (e instanceof TranscriptionError) {
      return NextResponse.json(
        { error: e.userMessage },
        { status: e.status }
      );
    }
    return NextResponse.json(
      {
        error: getAiUserMessage(
          e,
          "Transcription failed. Check that your Gemini API key is valid, then try a clearer 30 second to 5 minute recording."
        ),
      },
      { status: 502 }
    );
  }

  if (!transcript) {
    return NextResponse.json({ error: "Empty transcript" }, { status: 422 });
  }

  const streamMode = new URL(req.url).searchParams.get("stream") === "1";

  if (streamMode) {
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        try {
          send({ type: "transcript", transcript });

          const evaluation = await evaluateTranscriptStreaming(transcript, (text) => {
            send({ type: "eval_delta", text });
          });

          await connectDb();
          const test = await TestResult.create({
            user: userId,
            transcript,
            bandScore: evaluation.bandScore,
            breakdown: evaluation.breakdown,
            summary: evaluation.summary,
            audio: {
              mimeType: mime,
              size: file.size,
              durationSeconds,
            },
            ai: {
              provider: getAiProvider(),
              transcriptionModel: getTranscriptionModelName(),
              evaluationModel: getEvaluationModelName(),
              promptVersion: SPEAKING_PROMPT_VERSION,
            },
          });
          await User.findByIdAndUpdate(userId, { $push: { tests: test._id } });
          await PracticeAttempt.create({
            user: userId,
            module: "speaking",
            title: "Speaking sample",
            score: evaluation.bandScore,
            summary: evaluation.summary,
            details: {
              transcript,
              breakdown: evaluation.breakdown,
              durationSeconds,
            },
            ai: {
              provider: getAiProvider(),
              model: getEvaluationModelName(),
              promptVersion: SPEAKING_PROMPT_VERSION,
            },
          });

          const elapsedMs = Math.round(performance.now() - started);
          send({
            type: "result",
            transcript,
            bandScore: evaluation.bandScore,
            breakdown: evaluation.breakdown,
            summary: evaluation.summary,
            testId: String(test._id),
            elapsedMs,
          });
        } catch (e) {
          console.error(e);
          send({
            type: "error",
            message: getAiUserMessage(e, "Evaluation failed. Please try again in a moment."),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  let evaluation;
  try {
    evaluation = await evaluateTranscript(transcript);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: getAiUserMessage(e, "Evaluation failed. Please try again in a moment.") },
      { status: 502 }
    );
  }

  await connectDb();
  const test = await TestResult.create({
    user: userId,
    transcript,
    bandScore: evaluation.bandScore,
    breakdown: evaluation.breakdown,
    summary: evaluation.summary,
    audio: {
      mimeType: mime,
      size: file.size,
      durationSeconds,
    },
    ai: {
      provider: getAiProvider(),
      transcriptionModel: getTranscriptionModelName(),
      evaluationModel: getEvaluationModelName(),
      promptVersion: SPEAKING_PROMPT_VERSION,
    },
  });

  await User.findByIdAndUpdate(userId, { $push: { tests: test._id } });
  await PracticeAttempt.create({
    user: userId,
    module: "speaking",
    title: "Speaking sample",
    score: evaluation.bandScore,
    summary: evaluation.summary,
    details: {
      transcript,
      breakdown: evaluation.breakdown,
      durationSeconds,
    },
    ai: {
      provider: getAiProvider(),
      model: getEvaluationModelName(),
      promptVersion: SPEAKING_PROMPT_VERSION,
    },
  });

  const elapsedMs = Math.round(performance.now() - started);

  return NextResponse.json({
    transcript,
    bandScore: evaluation.bandScore,
    breakdown: evaluation.breakdown,
    summary: evaluation.summary,
    testId: String(test._id),
    elapsedMs,
  });
}
