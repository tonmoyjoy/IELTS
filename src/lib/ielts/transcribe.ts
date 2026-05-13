import { GoogleGenerativeAI } from "@google/generative-ai";

const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/aiff",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/opus",
  "audio/pcm",
  "audio/wav",
  "audio/webm",
]);

const DEFAULT_TRANSCRIBE_MODEL = "gemini-2.5-flash-lite";

export function getTranscriptionModelName() {
  return process.env.GEMINI_TRANSCRIBE_MODEL ?? process.env.GEMINI_MODEL ?? DEFAULT_TRANSCRIBE_MODEL;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly status = 502
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

function normalizeAudioMimeType(mimeType: string): string {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
  if (!normalized) return "audio/webm";
  if (normalized === "audio/x-m4a") return "audio/m4a";
  if (normalized === "audio/x-wav" || normalized === "audio/wave") return "audio/wav";
  return normalized;
}

function getErrorStatus(e: unknown): number | undefined {
  if (!e || typeof e !== "object") return undefined;
  const value = e as { status?: unknown };
  return typeof value.status === "number" ? value.status : undefined;
}

function getRetryDelaySeconds(message: string): number | null {
  const retryDelay = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelay?.[1]) return Number(retryDelay[1]);

  const retryIn = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (retryIn?.[1]) return Math.ceil(Number(retryIn[1]));

  return null;
}

function toTranscriptionError(e: unknown): TranscriptionError {
  const message = e instanceof Error ? e.message : String(e);
  const status = getErrorStatus(e);

  if (status === 429 || message.includes("429 Too Many Requests") || message.includes("quota")) {
    const retryDelay = getRetryDelaySeconds(message);
    return new TranscriptionError(
      message,
      retryDelay
        ? `Gemini quota is temporarily exhausted. Wait about ${retryDelay} seconds, then try again. If this keeps happening, create a fresh Google AI Studio key or enable billing for this Google Cloud project.`
        : "Gemini quota is exhausted for this API key/project. Create a fresh Google AI Studio key, wait for quota reset, or enable billing for the Google Cloud project.",
      429
    );
  }

  if (status === 400 && message.toLowerCase().includes("mime")) {
    return new TranscriptionError(
      message,
      "Gemini could not read this audio format. Try recording again in Chrome or Edge.",
      415
    );
  }

  if (status === 400 && message.toLowerCase().includes("api key")) {
    return new TranscriptionError(
      message,
      "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local, then restart the dev server.",
      401
    );
  }

  return new TranscriptionError(
    message,
    "Transcription failed. Check that your Gemini API key is valid, then try a clearer 30 second to 5 minute recording.",
    502
  );
}

/**
 * Gemini receives the recorded audio inline and returns a plain-text transcript.
 * For larger recordings, move to the Gemini Files API instead of inline data.
 */
export async function transcribeAudio(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new TranscriptionError(
      "GEMINI_API_KEY is missing",
      "Gemini API key is missing. Add GEMINI_API_KEY to .env.local, then restart the dev server.",
      500
    );
  }

  const mimeType = normalizeAudioMimeType(input.mimeType);
  if (!SUPPORTED_AUDIO_TYPES.has(mimeType)) {
    throw new TranscriptionError(
      `Unsupported audio MIME type: ${input.mimeType}`,
      `This browser recorded ${input.mimeType || "an unknown audio format"}, which Gemini may not accept. Try Chrome or Edge, or record again with a shorter clip.`,
      415
    );
  }

  const gen = new GoogleGenerativeAI(key);
  const model = gen.getGenerativeModel({
    model: getTranscriptionModelName(),
  });

  let result;
  try {
    result = await model.generateContent([
      {
        text:
          "Generate an accurate plain-text transcript of the spoken English in this audio. " +
          "Return only the transcript, with no markdown, timestamps, speaker labels, or commentary.",
      },
      {
        inlineData: {
          data: input.buffer.toString("base64"),
          mimeType,
        },
      },
    ]);
  } catch (e) {
    throw toTranscriptionError(e);
  }

  const transcript = result.response.text().trim();
  if (!transcript) {
    throw new TranscriptionError(
      "Gemini returned an empty transcript",
      "Gemini could not detect speech in that recording. Try again with a louder, clearer 30 second to 5 minute answer.",
      422
    );
  }

  return transcript;
}
