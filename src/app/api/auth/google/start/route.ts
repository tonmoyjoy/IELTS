import { NextResponse } from "next/server";
import { getAppUrl } from "@/server/env";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { OAUTH_COOKIE, OAUTH_COOKIE_TTL, beginGoogleSignIn, isGoogleConfigured } from "@/server/auth/google";
import { isSecureCookie } from "@/server/auth/cookie";
import { safeRedirectPath } from "@/lib/text";

/** Starts "Continue with Google": remembers the attempt in a signed cookie and redirects to Google. */
export async function GET(req: Request) {
  const back = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, getAppUrl()), 303);
  if (!isGoogleConfigured()) return back("google_unavailable");
  try {
    await enforceRateLimit([{ key: `google:ip:${getClientIp(req.headers)}`, limit: 30, windowSeconds: 15 * 60 }]);
  } catch {
    return back("rate_limited");
  }

  const from = safeRedirectPath(new URL(req.url).searchParams.get("from"));
  const { url, cookie } = await beginGoogleSignIn(from);
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: OAUTH_COOKIE_TTL,
  });
  return res;
}
