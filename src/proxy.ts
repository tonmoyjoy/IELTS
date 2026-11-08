import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/server/auth/jwt";
import { sessionCookieName } from "@/server/auth/cookie";
import { buildCsp, createNonce } from "@/server/security/csp";

/** Pages that require a session. Pages also check the session server-side; this only avoids a render. */
const PROTECTED_PREFIXES = ["/dashboard", "/practice", "/history", "/account", "/billing"];
/** Pages a signed-in user has no reason to see. */
const GUEST_ONLY = ["/login", "/register"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(sessionCookieName())?.value;
  const signedIn = token ? (await verifySessionToken(token)) !== null : false;

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  if (signedIn && matches(pathname, GUEST_ONLY)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    upgradeInsecure: (process.env.APP_URL ?? "").startsWith("https://"),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|listening/|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
