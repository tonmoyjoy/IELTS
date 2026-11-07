import { z } from "zod";
import { ApiError, handler, json } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser, type SessionUser } from "@/server/auth/session";
import { releaseQuota, reserveQuota } from "@/server/billing/quota";
import { getAudioDurationSeconds } from "@/server/audio/duration";
import { evaluateSpeaking, NoSpeechError, SPEAKING_PROMPT_VERSION, type SpeakingEvaluation } from "@/server/ai/speaking";
import { AI_PROVIDER } from "@/server/ai/client";
import { toAiApiError } from "@/server/ai/errors";
import { createAttempt, type AttemptSummary } from "@/server/services/attempts";
import { getEvaluationModel } from "@/server/env";
import { getSpeakingSet } from "@/content/speaking";
import type { SpeakingSet } from "@/content/types";

export const maxDuration = 120;

const MIN_SECONDS = 30;
const MAX_SECONDS = 5 * 60;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

const SUPPORTED_MIME = new Map<string, string>([
  ["audio/webm", "audio/webm"],
  ["video/webm", "audio/webm"],
  ["audio/ogg", "audio/ogg"],
  ["audio/mp4", "audio/mp4"],
  ["audio/x-m4a", "audio/mp4"],
  ["audio/m4a", "audio/mp4"],
  ["audio/aac", "audio/aac"],
  ["audio/mpeg", "audio/mpeg"],
  ["audio/mp3", "audio/mpeg"],
  ["audio/wav", "audio/wav"],
  ["audio/x-wav", "audio/wav"],
  ["audio/wave", "audio/wav"],
  ["audio/flac", "audio/flac"],
]);

const fieldsSchema = z.object({ setId: z.string().max(80).optional() });

type Prepared = {
  user: SessionUser;
  audio: Buffer;
  mimeType: string;
  durationSeconds: number;
  set: SpeakingSet | undefined;
};

async function prepare(req: Request): Promise<Prepared> {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `speaking:user:${user.id}`, limit: 20, windowSeconds: 60 * 60 }]);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected a multipart/form-data upload.");
  }
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Recording is too large. Keep it under 10 MB.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "INVALID_FORM", "Could not read the upload. Please try again.");
  }

  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, "MISSING_AUDIO", "No recording was attached.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Recording is too large. Keep it under 10 MB.");
  }

  const baseType = (file.type || "").split(";")[0].trim().toLowerCase();
  const mimeType = SUPPORTED_MIME.get(baseType);
  if (!mimeType) {
    throw new ApiError(415, "UNSUPPORTED_AUDIO", "Unsupported audio format. Use MP3, M4A, WAV, OGG or WebM.");
  }

  const fields = fieldsSchema.safeParse({ setId: form.get("setId") ?? undefined });
  const set = fields.success && fields.data.setId ? getSpeakingSet(fields.data.setId) : undefined;

  const audio = Buffer.from(await file.arrayBuffer());
  const durationSeconds = await getAudioDurationSeconds(audio, mimeType);
  if (durationSeconds == null) {
    throw new ApiError(415, "AUDIO_UNREADABLE", "We could not read the length of that recording. Please record again.");
  }
  if (durationSeconds < MIN_SECONDS - 0.5) {
    throw new ApiError(400, "RECORDING_TOO_SHORT", `Recording is too short. Speak for at least ${MIN_SECONDS} seconds.`);
  }
  if (durationSeconds > MAX_SECONDS + 1) {
    throw new ApiError(400, "RECORDING_TOO_LONG", "Recording is too long. Keep your answer under 5 minutes.");
  }

  return { user, audio, mimeType, durationSeconds, set };
}

async function runEvaluation(prepared: Prepared): Promise<{ evaluation: SpeakingEvaluation; attempt: AttemptSummary; latencyMs: number }> {
  const { user, audio, mimeType, durationSeconds, set } = prepared;
  await reserveQuota(user.id, user.plan, "speaking");
  const started = performance.now();
  try {
    const evaluation = await evaluateSpeaking({ audio, mimeType, durationSeconds, set });
    const latencyMs = Math.round(performance.now() - started);
    const attempt = await createAttempt({
      userId: user.id,
      module: "speaking",
      contentId: set?.id ?? "free-topic",
      title: set ? `Speaking: ${set.title}` : "Speaking: free topic",
      score: evaluation.bandScore,
      summary: evaluation.summary,
      details: {
        transcript: evaluation.transcript,
        criteria: evaluation.criteria,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        durationSeconds: Math.round(durationSeconds),
      },
      ai: { provider: AI_PROVIDER, model: getEvaluationModel(), promptVersion: SPEAKING_PROMPT_VERSION, latencyMs },
    });
    return { evaluation, attempt, latencyMs };
  } catch (error) {
    await releaseQuota(user.id, "speaking").catch(() => {});
    if (error instanceof NoSpeechError) {
      throw new ApiError(422, "NO_SPEECH", "We could not hear any English speech in that recording. Please try again.");
    }
    throw toAiApiError(error, "speaking.evaluate");
  }
}

/**
 * Speaking evaluation. Validation, auth and quota errors are returned as
 * normal JSON errors. With `Accept: text/event-stream` the scoring phase is
 * streamed as server-sent events (progress heartbeats, then result or error)
 * so proxies do not time out long requests.
 */
export const POST = handler("speaking.evaluate", async (req) => {
  const prepared = await prepare(req);
  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

  if (!wantsStream) {
    const { evaluation, attempt, latencyMs } = await runEvaluation(prepared);
    return json({ evaluation, attempt, latencyMs }, { status: 201 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("progress", { stage: "scoring" });
      const heartbeat = setInterval(() => send("progress", { stage: "scoring" }), 10_000);
      try {
        const result = await runEvaluation(prepared);
        send("result", result);
      } catch (error) {
        const apiError =
          error instanceof ApiError ? error : new ApiError(500, "INTERNAL", "Something went wrong. Please try again.");
        send("error", { error: apiError.message, code: apiError.code });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
