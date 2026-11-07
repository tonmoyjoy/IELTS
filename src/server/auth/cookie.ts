import { SESSION_TTL_SECONDS } from "@/server/auth/jwt";

/**
 * Secure cookies in production unless the app is explicitly served over
 * plain HTTP (e.g. a local `docker compose up` trial at http://localhost).
 *
 * When secure, the `__Host-` prefix is used: the browser only accepts the
 * cookie when it is Secure, has Path=/ and no Domain, which blocks subdomain
 * cookie injection.
 */
export function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production" && !/^http:\/\//i.test(process.env.APP_URL ?? "");
}

export function sessionCookieName(): string {
  return isSecureCookie() ? "__Host-ielts_session" : "ielts_session";
}

function baseOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
  };
}

type CookieSetter = { cookies: { set: (name: string, value: string, options: object) => unknown } };

export function setSessionCookie(res: CookieSetter, token: string) {
  res.cookies.set(sessionCookieName(), token, { ...baseOptions(), maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie(res: CookieSetter) {
  res.cookies.set(sessionCookieName(), "", { ...baseOptions(), maxAge: 0 });
}
