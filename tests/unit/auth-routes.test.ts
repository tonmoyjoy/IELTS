import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectDb,
  userFindOne,
  userCreate,
  userFindById,
  signAuthToken,
  hashPassword,
  comparePassword,
  rateLimit,
  getClientIp,
  requireSameOrigin,
  createActionToken,
  getAppUrl,
  sendEmail,
  getSessionUserId,
} = vi.hoisted(() => ({
  connectDb: vi.fn(),
  userFindOne: vi.fn(),
  userCreate: vi.fn(),
  userFindById: vi.fn(),
  signAuthToken: vi.fn(),
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
  requireSameOrigin: vi.fn(),
  createActionToken: vi.fn(),
  getAppUrl: vi.fn(),
  sendEmail: vi.fn(),
  getSessionUserId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  connectDb,
}));

vi.mock("@/lib/models/User", () => ({
  User: {
    findOne: userFindOne,
    create: userCreate,
    findById: userFindById,
  },
}));

vi.mock("@/lib/auth/jwt", () => ({
  signAuthToken,
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: hashPassword,
    compare: comparePassword,
  },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit,
  getClientIp,
}));

vi.mock("@/lib/security/request-guards", () => ({
  requireSameOrigin,
}));

vi.mock("@/lib/auth/tokens", () => ({
  createActionToken,
  getAppUrl,
}));

vi.mock("@/lib/email/send-email", () => ({
  sendEmail,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUserId,
}));

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    signAuthToken.mockResolvedValue("signed-token");
    hashPassword.mockResolvedValue("hashed-password");
    comparePassword.mockResolvedValue(true);
    rateLimit.mockResolvedValue(null);
    getClientIp.mockReturnValue("127.0.0.1");
    requireSameOrigin.mockReturnValue(null);
    createActionToken.mockReturnValue({ token: "verify-token", hash: "verify-hash" });
    getAppUrl.mockReturnValue("http://localhost:3000");
    sendEmail.mockResolvedValue({ sent: false });
    connectDb.mockResolvedValue(undefined);
  });

  it("registers successfully", async () => {
    userFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    userCreate.mockResolvedValue({
      _id: "user-1",
      email: "new@example.com",
      emailVerified: false,
    });

    const res = await registerPost(
      postRequest("http://localhost:3000/api/auth/register", {
        email: "new@example.com",
        password: "password12345",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.email).toBe("new@example.com");
    expect(res.headers.get("set-cookie")).toContain("auth_token=signed-token");
  });

  it("rejects duplicate email on register", async () => {
    userFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "existing" }) });

    const res = await registerPost(
      postRequest("http://localhost:3000/api/auth/register", {
        email: "taken@example.com",
        password: "password12345",
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Email already registered" });
  });

  it("logs in successfully", async () => {
    userFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: "user-1",
          email: "login@example.com",
          emailVerified: true,
          password: "hashed-password",
        }),
      }),
    });

    const res = await loginPost(
      postRequest("http://localhost:3000/api/auth/login", {
        email: "login@example.com",
        password: "password12345",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.email).toBe("login@example.com");
  });

  it("rejects invalid login credentials", async () => {
    comparePassword.mockResolvedValue(false);
    userFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: "user-1",
          email: "login@example.com",
          password: "hashed-password",
        }),
      }),
    });

    const res = await loginPost(
      postRequest("http://localhost:3000/api/auth/login", {
        email: "login@example.com",
        password: "wrong-password",
      })
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid email or password" });
  });

  it("logout clears auth cookie", async () => {
    const res = await logoutPost(new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("auth_token=;");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("/api/auth/me requires auth and returns user info when authenticated", async () => {
    getSessionUserId.mockResolvedValueOnce(null);
    const unauth = await meGet();
    expect(unauth.status).toBe(401);

    getSessionUserId.mockResolvedValueOnce("user-1");
    userFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "user-1", email: "me@example.com" }),
    });

    const authed = await meGet();
    expect(authed.status).toBe(200);
    await expect(authed.json()).resolves.toMatchObject({
      user: { id: "user-1", email: "me@example.com" },
    });
  });
});
