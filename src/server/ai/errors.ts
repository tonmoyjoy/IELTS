import { ApiError } from "@/server/http/api";
import { log } from "@/server/log";

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return undefined;
}

/**
 * Maps provider errors to messages that are safe and useful for end users.
 * Provider details (keys, quotas, model names) are logged, never shown.
 */
export function toAiApiError(error: unknown, operation: string): ApiError {
  if (error instanceof ApiError) return error;

  const status = statusOf(error);
  const message = error instanceof Error ? error.message : String(error);
  log.error("ai.request_failed", { operation, status, error });

  if (status === 429 || /quota|rate.?limit|resource.?exhausted/i.test(message)) {
    return new ApiError(503, "AI_BUSY", "Our AI examiner is busy right now. Please try again in a minute.", {
      headers: { "Retry-After": "60" },
    });
  }
  if (status === 400 && /mime|audio|unsupported|inline/i.test(message)) {
    return new ApiError(415, "AUDIO_UNREADABLE", "We could not read that recording. Please try recording again.");
  }
  if (status === 400 && /safety|blocked/i.test(message)) {
    return new ApiError(422, "CONTENT_BLOCKED", "This response could not be scored. Please submit a different answer.");
  }
  if (status === 401 || status === 403 || /api key/i.test(message)) {
    return new ApiError(503, "AI_UNAVAILABLE", "AI scoring is temporarily unavailable. Please try again later.");
  }
  return new ApiError(502, "AI_FAILED", "Scoring failed. Please try again in a moment.");
}
