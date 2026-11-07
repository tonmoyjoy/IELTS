import { createHash, randomBytes } from "node:crypto";

/** Single-use action token (email verification, password reset). Only the hash is stored. */
export function createActionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashActionToken(token) };
}

export function hashActionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const ACTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
