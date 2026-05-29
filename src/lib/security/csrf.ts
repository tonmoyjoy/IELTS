export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken() {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    return rawValue.join("=").trim() || null;
  }

  return null;
}

