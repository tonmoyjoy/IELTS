import { getEnv } from "@/server/env";
import { ApiError } from "@/server/http/api";

function toOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return null;
  }
}

/** Explicit allowlist of origins permitted to send state-changing requests. */
export function getAllowedOrigins(): Set<string> {
  const env = getEnv();
  const origins = new Set<string>();
  for (const candidate of [
    env.APP_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    ...env.ALLOWED_ORIGINS,
  ]) {
    const origin = toOrigin(candidate);
    if (origin) origins.add(origin);
  }
  return origins;
}

function isLocalDevOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * CSRF defence for cookie-authenticated mutations.
 *
 * Browsers always send `Origin` on cross-origin and same-origin POST/PUT/
 * PATCH/DELETE requests made with fetch, and send `Sec-Fetch-Site` on every
 * request. A request is accepted when its Origin is on the allowlist, or when
 * Origin is absent but the browser says the request is same-origin. In
 * production a request with neither header is rejected. Combined with the
 * SameSite=Lax session cookie and JSON-only bodies this matches the
 * protection of a synchronizer token without the extra round trip.
 */
export function assertSameOrigin(req: Request) {
  const env = getEnv();
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");

  if (origin) {
    const parsed = toOrigin(origin);
    if (parsed && getAllowedOrigins().has(parsed)) return;
    if (parsed && env.NODE_ENV !== "production" && isLocalDevOrigin(parsed)) return;
    throw new ApiError(403, "CROSS_ORIGIN_BLOCKED", "Cross-origin request blocked.");
  }

  if (fetchSite) {
    if (fetchSite === "same-origin" || fetchSite === "none") return;
    throw new ApiError(403, "CROSS_ORIGIN_BLOCKED", "Cross-origin request blocked.");
  }

  if (env.NODE_ENV === "production") {
    throw new ApiError(403, "CROSS_ORIGIN_BLOCKED", "Request origin could not be verified.");
  }
}
