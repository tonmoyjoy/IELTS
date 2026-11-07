import { describe, expect, it } from "vitest";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as verify from "@/app/api/auth/verify-email/route";
import * as resend from "@/app/api/auth/resend-verification/route";
import * as forgot from "@/app/api/auth/forgot-password/route";
import * as reset from "@/app/api/auth/reset-password/route";
import { User } from "@/server/models/User";
import { sessionCookieName } from "@/server/auth/cookie";
import { call, cookieJar, lastEmailTo, outbox, sessionCookie, tokenFromEmail } from "./helpers";

const password = "correct horse battery";

async function registerAndVerify(email: string) {
  expect((await call(register.POST, { json: { email, password } })).status).toBe(202);
  const token = tokenFromEmail(email, "verify-email");
  expect((await call(verify.POST, { json: { token } })).status).toBe(200);
}

describe("registration", () => {
  it("never reveals whether an email is registered and never returns links", async () => {
    const first = await call(register.POST, { json: { email: "Ann@Example.com", password } });
    const second = await call(register.POST, { json: { email: "ann@example.com", password: "another password" } });

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.body).toEqual(first.body);
    expect(JSON.stringify(first.body)).not.toMatch(/token|http/i);
    expect(sessionCookie()).toBeUndefined();
    expect(await User.countDocuments({ email: "ann@example.com" })).toBe(1);
    expect(outbox.filter((m) => m.to === "ann@example.com")).toHaveLength(2);
  });

  it("emails the existing owner instead of creating a duplicate", async () => {
    await registerAndVerify("bob@example.com");
    await call(register.POST, { json: { email: "bob@example.com", password } });
    expect(lastEmailTo("bob@example.com").subject).toMatch(/already have/i);
  });

  it("validates input with field errors", async () => {
    const res = await call(register.POST, { json: { email: "not-an-email", password: "short" } });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields as object)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rejects passwords longer than bcrypt can use", async () => {
    const res = await call(register.POST, { json: { email: "long@example.com", password: "x".repeat(73) } });
    expect(res.status).toBe(400);
  });
});

describe("sign in", () => {
  it("requires a verified email, then issues a session cookie", async () => {
    await call(register.POST, { json: { email: "cat@example.com", password } });
    const blocked = await call(login.POST, { json: { email: "cat@example.com", password } });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("EMAIL_NOT_VERIFIED");

    await call(resend.POST, { json: { email: "cat@example.com" } });
    const token = tokenFromEmail("cat@example.com", "verify-email");
    expect((await call(verify.POST, { json: { token } })).status).toBe(200);
    expect((await call(verify.POST, { json: { token } })).status).toBe(400); // single use

    const ok = await call(login.POST, { json: { email: "CAT@example.com", password } });
    expect(ok.status).toBe(200);
    expect(sessionCookie()).toBeTruthy();
    const profile = await call(me.GET);
    expect(profile.status).toBe(200);
    expect((profile.body.user as { email: string }).email).toBe("cat@example.com");
    expect((profile.body.usage as { plan: string }).plan).toBe("free");
  });

  it("gives the same error for unknown accounts and wrong passwords", async () => {
    await registerAndVerify("dan@example.com");
    const wrong = await call(login.POST, { json: { email: "dan@example.com", password: "nope nope nope" } });
    const unknown = await call(login.POST, { json: { email: "nobody@example.com", password } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("rate-limits repeated attempts against one account", async () => {
    await registerAndVerify("eve@example.com");
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await call(login.POST, { json: { email: "eve@example.com", password: "wrong password" } })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("blocks cross-origin requests", async () => {
    const res = await call(login.POST, { json: { email: "x@example.com", password }, headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("logout clears the cookie", async () => {
    await registerAndVerify("fay@example.com");
    await call(login.POST, { json: { email: "fay@example.com", password } });
    expect(sessionCookie()).toBeTruthy();
    await call(logout.POST, { method: "POST" });
    expect(sessionCookie()).toBeUndefined();
    expect((await call(me.GET)).status).toBe(401);
  });
});

describe("password reset", () => {
  it("never leaks the reset link and responds identically for unknown emails", async () => {
    await registerAndVerify("gus@example.com");
    const known = await call(forgot.POST, { json: { email: "gus@example.com" } });
    const unknown = await call(forgot.POST, { json: { email: "ghost@example.com" } });
    expect(known.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(JSON.stringify(known.body)).not.toMatch(/token|http/i);
    expect(outbox.some((m) => m.to === "ghost@example.com")).toBe(false);
  });

  it("revokes existing sessions and the old password", async () => {
    await registerAndVerify("hal@example.com");
    await call(login.POST, { json: { email: "hal@example.com", password } });
    const oldSession = sessionCookie()!;

    await call(forgot.POST, { json: { email: "hal@example.com" } });
    const token = tokenFromEmail("hal@example.com", "reset-password");
    const res = await call(reset.POST, { json: { token, password: "a brand new password" } });
    expect(res.status).toBe(200);

    // Replay the stolen/old cookie: it must no longer work.
    cookieJar.set(sessionCookieName(), oldSession);
    expect((await call(me.GET)).status).toBe(401);

    expect((await call(login.POST, { json: { email: "hal@example.com", password } })).status).toBe(401);
    expect((await call(login.POST, { json: { email: "hal@example.com", password: "a brand new password" } })).status).toBe(200);
    expect((await call(reset.POST, { json: { token, password: "yet another password" } })).status).toBe(400);
  });

  it("rejects expired reset tokens", async () => {
    await registerAndVerify("ivy@example.com");
    await call(forgot.POST, { json: { email: "ivy@example.com" } });
    const token = tokenFromEmail("ivy@example.com", "reset-password");
    await User.updateOne({ email: "ivy@example.com" }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
    expect((await call(reset.POST, { json: { token, password: "a brand new password" } })).status).toBe(400);
  });
});
