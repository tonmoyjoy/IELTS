import { readSse } from "@/lib/sse";

export type SpeakingEvaluation = {
  bandScore: number;
  criteria: { fluencyCoherence: number; lexicalResource: number; grammaticalRange: number; pronunciation: number };
  transcript: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

export type SpeakingResultPayload = { evaluation: SpeakingEvaluation; attempt: { id: string } };

export function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

export function microphoneHint(): string {
  if (!window.isSecureContext) return "Microphone access needs a secure page (https:// or http://localhost).";
  return "Allow microphone access in your browser's site settings, then try again.";
}

/**
 * Uploads a recording for scoring and waits for the streamed result.
 * Resolves with the result or an error message; never throws.
 */
export async function submitSpeaking(
  blob: Blob,
  options: { setId: string; mode?: "answer" | "full"; onScoring?: () => void }
): Promise<{ ok: true; result: SpeakingResultPayload } | { ok: false; error: string; code?: string }> {
  const form = new FormData();
  const type = blob.type || "audio/webm";
  const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : "webm";
  form.append("audio", blob, blob instanceof File ? blob.name : `answer.${ext}`);
  form.append("setId", options.setId);
  form.append("mode", options.mode ?? "answer");

  let res: Response;
  try {
    res = await fetch("/api/speaking/evaluate", { method: "POST", body: form, headers: { Accept: "text/event-stream" }, credentials: "same-origin" });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    return { ok: false, error: body?.error ?? "Scoring could not start. Please try again.", code: body?.code };
  }

  options.onScoring?.();
  let outcome: { ok: true; result: SpeakingResultPayload } | { ok: false; error: string; code?: string } | null = null;
  try {
    await readSse(res, (event) => {
      if (event.event === "result") outcome = { ok: true, result: event.data as SpeakingResultPayload };
      else if (event.event === "error") {
        const data = event.data as { error?: string; code?: string };
        outcome = { ok: false, error: data.error ?? "Scoring failed. Please try again.", code: data.code };
      }
    });
  } catch {
    // handled below
  }
  return outcome ?? { ok: false, error: "The connection closed before scoring finished. Please try again." };
}
