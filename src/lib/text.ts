/** Word count using IELTS conventions: whitespace-separated tokens; hyphenated words count once. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * Only allow redirects to same-site relative paths. Rejects protocol-relative
 * (`//evil.com`), backslash tricks (`/\evil.com`) and absolute URLs.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return fallback;
  }
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
