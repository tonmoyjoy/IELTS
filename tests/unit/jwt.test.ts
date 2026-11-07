import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSessionToken, verifySessionToken } from "@/server/auth/jwt";
import { getJwtSecret } from "@/server/env";

const userId = "64b7f0c2a1b2c3d4e5f60718";

describe("session tokens", () => {
  it("round-trips user id and token version", async () => {
    const token = await signSessionToken(userId, 3);
    await expect(verifySessionToken(token)).resolves.toEqual({ sub: userId, tv: 3 });
  });

  it("rejects tampered tokens", async () => {
    const token = await signSessionToken(userId, 0);
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("rejects tokens without the expected audience or version claim", async () => {
    const key = new TextEncoder().encode(getJwtSecret());
    const legacy = await new SignJWT({ email: "a@b.com" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setExpirationTime("1h").sign(key);
    await expect(verifySessionToken(legacy)).resolves.toBeNull();
  });

  it("rejects expired tokens and non-ObjectId subjects", async () => {
    const key = new TextEncoder().encode(getJwtSecret());
    const base = () =>
      new SignJWT({ tv: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuer("ielts-practice-studio").setAudience("ielts-practice-studio:session");
    const expired = await base().setSubject(userId).setIssuedAt(1).setExpirationTime(2).sign(key);
    await expect(verifySessionToken(expired)).resolves.toBeNull();
    const badSub = await base().setSubject("../../admin").setExpirationTime("1h").sign(key);
    await expect(verifySessionToken(badSub)).resolves.toBeNull();
  });

  it("rejects the alg=none trick", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: userId, tv: 0 })).toString("base64url");
    await expect(verifySessionToken(`${header}.${payload}.`)).resolves.toBeNull();
  });
});
