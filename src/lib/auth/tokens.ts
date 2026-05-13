import { createHash, randomBytes } from "crypto";

export function createActionToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    hash: hashActionToken(token),
  };
}

export function hashActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getAppUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
