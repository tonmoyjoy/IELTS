import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getAppUrl, getEnv, getJwtSecret } from "@/server/env";

/**
 * Google sign-in with the OAuth 2.0 authorization-code flow + PKCE.
 * The transient state/nonce/verifier travel in a short-lived signed cookie,
 * and the ID token is verified against Google's published keys.
 */

const DEFAULTS = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  jwks: "https://www.googleapis.com/oauth2/v3/certs",
};
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "ielts_google_oauth";
const OAUTH_AUDIENCE = "ielts-practice-studio:google-oauth";
const OAUTH_TTL_SECONDS = 10 * 60;

export function isGoogleConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${getAppUrl()}/api/auth/google/callback`;
}

function endpoints() {
  const env = getEnv();
  return {
    auth: env.GOOGLE_AUTH_URL ?? DEFAULTS.auth,
    token: env.GOOGLE_TOKEN_URL ?? DEFAULTS.token,
    jwks: env.GOOGLE_JWKS_URL ?? DEFAULTS.jwks,
  };
}

let jwks: { url: string; get: JWTVerifyGetKey } | null = null;

/** Google's signing keys, cached by jose between requests. */
export function getGoogleKeys(): JWTVerifyGetKey {
  const url = endpoints().jwks;
  if (!jwks || jwks.url !== url) jwks = { url, get: createRemoteJWKSet(new URL(url)) };
  return jwks.get;
}

const random = () => randomBytes(32).toString("base64url");
const s256 = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const cookieKey = () => new TextEncoder().encode(getJwtSecret());

export type OAuthState = { state: string; nonce: string; verifier: string; from: string };

/** Builds the Google consent URL and the signed cookie that remembers this attempt. */
export async function beginGoogleSignIn(from: string): Promise<{ url: string; cookie: string }> {
  const env = getEnv();
  const flow: OAuthState = { state: random(), nonce: random(), verifier: random(), from };
  const url = new URL(endpoints().auth);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: s256(flow.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const cookie = await new SignJWT({ ...flow })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(OAUTH_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(cookieKey());
  return { url: url.toString(), cookie };
}

export async function readOAuthCookie(value: string | undefined): Promise<OAuthState | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtVerify(value, cookieKey(), { algorithms: ["HS256"], audience: OAUTH_AUDIENCE });
    const { state, nonce, verifier, from } = payload as Record<string, unknown>;
    if ([state, nonce, verifier, from].some((v) => typeof v !== "string")) return null;
    return { state, nonce, verifier, from } as OAuthState;
  } catch {
    return null;
  }
}

export function sameState(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const OAUTH_COOKIE_TTL = OAUTH_TTL_SECONDS;

export type GoogleIdentity = { sub: string; email: string; name?: string };

export class GoogleSignInError extends Error {
  constructor(public readonly reason: string) {
    super(`Google sign-in failed: ${reason}`);
    this.name = "GoogleSignInError";
  }
}

/** Exchanges the authorization code and verifies the returned ID token. */
export async function finishGoogleSignIn(code: string, flow: OAuthState): Promise<GoogleIdentity> {
  const env = getEnv();
  const res = await fetch(endpoints().token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !data?.id_token) throw new GoogleSignInError(`token_exchange:${data?.error ?? res.status}`);

  let claims: Record<string, unknown>;
  try {
    const verified = await jwtVerify(data.id_token, getGoogleKeys(), {
      issuer: ISSUERS,
      audience: env.GOOGLE_CLIENT_ID,
      algorithms: ["RS256"],
    });
    claims = verified.payload as Record<string, unknown>;
  } catch {
    throw new GoogleSignInError("invalid_id_token");
  }

  if (claims.nonce !== flow.nonce) throw new GoogleSignInError("nonce_mismatch");
  if (claims.email_verified !== true || typeof claims.email !== "string" || typeof claims.sub !== "string") {
    throw new GoogleSignInError("email_not_verified");
  }
  return { sub: claims.sub, email: claims.email, name: typeof claims.name === "string" ? claims.name : undefined };
}
