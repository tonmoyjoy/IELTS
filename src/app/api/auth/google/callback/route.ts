import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAppUrl } from "@/server/env";
import { log } from "@/server/log";
import { ApiError } from "@/server/http/api";
import { OAUTH_COOKIE, GoogleSignInError, finishGoogleSignIn, readOAuthCookie, sameState } from "@/server/auth/google";
import { signInWithGoogle } from "@/server/services/auth";
import { signSessionToken } from "@/server/auth/jwt";
import { isSecureCookie, setSessionCookie } from "@/server/auth/cookie";
import { safeRedirectPath } from "@/lib/text";

/** Google redirects here with ?code&state. Every failure lands back on /login with a reason. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const flow = await readOAuthCookie(jar.get(OAUTH_COOKIE)?.value);

  const finish = (res: NextResponse) => {
    res.headers.set("Cache-Control", "no-store");
    res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: isSecureCookie(), sameSite: "lax", path: "/api/auth/google", maxAge: 0 });
    return res;
  };
  const fail = (error: string) => finish(NextResponse.redirect(new URL(`/login?error=${error}`, getAppUrl()), 303));

  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "google_cancelled" : "google_failed");
  if (!flow) return fail("google_expired");
  if (!sameState(flow.state, params.get("state"))) return fail("google_failed");
  const code = params.get("code");
  if (!code) return fail("google_failed");

  try {
    const identity = await finishGoogleSignIn(code, flow);
    const account = await signInWithGoogle(identity);
    const res = NextResponse.redirect(new URL(safeRedirectPath(flow.from), getAppUrl()), 303);
    setSessionCookie(res, await signSessionToken(account.id, account.tokenVersion));
    return finish(res);
  } catch (error) {
    if (error instanceof ApiError && error.code === "GOOGLE_ACCOUNT_MISMATCH") return fail("google_mismatch");
    log.warn("auth.google_failed", { reason: error instanceof GoogleSignInError ? error.reason : undefined, error });
    return fail("google_failed");
  }
}
