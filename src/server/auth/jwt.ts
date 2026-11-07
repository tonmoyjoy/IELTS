import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "@/server/env";

/**
 * Session JWT. Deliberately minimal: user id + token version. The version is
 * checked against the database on every authenticated request, so bumping
 * `user.tokenVersion` revokes all existing sessions.
 *
 * This module is imported by `src/proxy.ts`, so it must not import
 * `server-only` or the database.
 */

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const ISSUER = "ielts-practice-studio";
const AUDIENCE = "ielts-practice-studio:session";

export type SessionClaims = { sub: string; tv: number };

function secretKey() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function signSessionToken(userId: string, tokenVersion: number): Promise<string> {
  return new SignJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== "string" || !/^[a-f0-9]{24}$/i.test(payload.sub)) return null;
    const tv = typeof payload.tv === "number" && Number.isInteger(payload.tv) ? payload.tv : null;
    if (tv == null) return null;
    return { sub: payload.sub, tv };
  } catch {
    return null;
  }
}
