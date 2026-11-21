import manifest from "@/content/audio-manifest.json";

/**
 * Audio rendered by `npm run audio:generate` (Gemini TTS). Paths are relative
 * to /public. Anything missing falls back gracefully (browser voice for the
 * speaking examiner).
 */
export const GENERATED_AUDIO: string[] = Object.keys((manifest as { files: Record<string, string> }).files);

export function examinerClipsFor(setId: string): string[] {
  return GENERATED_AUDIO.filter((file) => file.startsWith(`speaking/${setId}/`) || file.startsWith("speaking/common/"));
}
