import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import * as start from "@/app/api/auth/google/start/route";
import * as callback from "@/app/api/auth/google/callback/route";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import { User } from "@/server/models/User";
import { OAUTH_COOKIE } from "@/server/auth/google";
import { resetEnvCache } from "@/server/env";
import { call, cookieJar, sessionCookie } from "./helpers";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
let nextClaims: Record<string, unknown> = {};
let tokenRequest: URLSearchParams | null = null;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
});

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_JWKS_URL", "https://jwks.test/certs");
  vi.stubEnv("GOOGLE_TOKEN_URL", "https://token.test/token");
  resetEnvCache();
  tokenRequest = null;
  nextClaims = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === "https://jwks.test/certs") return Response.json({ keys: [publicJwk] });
      if (url === "https://token.test/token") {
        tokenRequest = new URLSearchParams(String(init?.body));
        const idToken = await new SignJWT({ email_verified: true, ...nextClaims })
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer("https://accounts.google.com")
          .setAudience(String(nextClaims.aud ?? CLIENT_ID))
          .setSubject(String(nextClaims.sub ?? "google-123"))
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        return Response.json({ id_token: idToken, access_token: "x" });
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
});

/** Runs start → (pretend Google) → callback. Returns the callback response. */
async function googleSignIn(claims: Record<string, unknown>, options: { from?: string; tamperState?: boolean } = {}) {
  const started = await call(start.GET, { path: `/api/auth/google/start${options.from ? `?from=${encodeURIComponent(options.from)}` : ""}` });
  expect(started.status).toBe(303);
  const consent = new URL(started.headers.get("location")!);
  expect(consent.searchParams.get("code_challenge_method")).toBe("S256");
  expect(consent.searchParams.get("client_id")).toBe(CLIENT_ID);
  expect(cookieJar.has(OAUTH_COOKIE)).toBe(true);

  nextClaims = { nonce: consent.searchParams.get("nonce"), ...claims };
  const state = options.tamperState ? "forged-state" : consent.searchParams.get("state")!;
  return call(callback.GET, { path: `/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}` });
}

describe("Continue with Google", () => {
  it("creates a verified account and signs in, using PKCE", async () => {
    const res = await googleSignIn({ email: "New.User@Gmail.com", sub: "g-new" }, { from: "/practice/reading" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/practice/reading");
    expect(tokenRequest?.get("code_verifier")).toBeTruthy();
    expect(tokenRequest?.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(sessionCookie()).toBeTruthy();
    expect(cookieJar.has(OAUTH_COOKIE)).toBe(false);

    const user = await User.findOne({ email: "new.user@gmail.com" }).lean();
    expect(user).toMatchObject({ emailVerified: true, googleId: "g-new" });
    expect((await call(me.GET)).status).toBe(200);
  });

  it("signs the same Google account back into the same user", async () => {
    await googleSignIn({ email: "same@gmail.com", sub: "g-same" });
    cookieJar.clear();
    await googleSignIn({ email: "same@gmail.com", sub: "g-same" });
    expect(await User.countDocuments({ email: "same@gmail.com" })).toBe(1);
  });

  it("links to an existing verified email account and keeps its password", async () => {
    await call(register.POST, { json: { email: "linked@gmail.com", password: "existing password" } });
    await User.updateOne({ email: "linked@gmail.com" }, { $set: { emailVerified: true } });
    await googleSignIn({ email: "linked@gmail.com", sub: "g-linked" });
    expect((await User.findOne({ email: "linked@gmail.com" }).lean())?.googleId).toBe("g-linked");
    cookieJar.clear();
    expect((await call(login.POST, { json: { email: "linked@gmail.com", password: "existing password" } })).status).toBe(200);
  });

  it("defeats account pre-hijacking of an unverified registration", async () => {
    // Attacker registers the victim's email with a password they know, but can't verify it.
    await call(register.POST, { json: { email: "victim@gmail.com", password: "attacker password" } });
    // The real owner later signs in with Google.
    await googleSignIn({ email: "victim@gmail.com", sub: "g-victim" });
    cookieJar.clear();
    const attacker = await call(login.POST, { json: { email: "victim@gmail.com", password: "attacker password" } });
    expect(attacker.status).toBe(401);
  });

  it("rejects unverified Google emails, wrong audience, wrong nonce and forged state", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const unverified = await googleSignIn({ email: "x@gmail.com", sub: "g1", email_verified: false });
    expect(unverified.headers.get("location")).toMatch(/error=google_failed/);
    const wrongAud = await googleSignIn({ email: "x@gmail.com", sub: "g2", aud: "someone-else" });
    expect(wrongAud.headers.get("location")).toMatch(/error=google_failed/);
    const wrongNonce = await googleSignIn({ email: "x@gmail.com", sub: "g3", nonce: "replayed" });
    expect(wrongNonce.headers.get("location")).toMatch(/error=google_failed/);
    const forged = await googleSignIn({ email: "x@gmail.com", sub: "g4" }, { tamperState: true });
    expect(forged.headers.get("location")).toMatch(/error=google_failed/);
    expect(sessionCookie()).toBeUndefined();
    expect(await User.countDocuments({ email: "x@gmail.com" })).toBe(0);
  });

  it("ignores open-redirect attempts in `from`", async () => {
    const res = await googleSignIn({ email: "redir@gmail.com", sub: "g-redir" }, { from: "//evil.example" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("refuses a callback without the start cookie", async () => {
    const res = await call(callback.GET, { path: "/api/auth/google/callback?code=abc&state=x" });
    expect(res.headers.get("location")).toMatch(/error=google_expired/);
  });

  it("is hidden and harmless when not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    resetEnvCache();
    const res = await call(start.GET, { path: "/api/auth/google/start" });
    expect(res.headers.get("location")).toMatch(/error=google_unavailable/);
  });
});
