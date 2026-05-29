import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectDb,
  getSessionUserId,
  requireSameOrigin,
  rateLimit,
  getClientIp,
  testResultFind,
  practiceAttemptFind,
  practiceAttemptCreate,
} = vi.hoisted(() => ({
  connectDb: vi.fn(),
  getSessionUserId: vi.fn(),
  requireSameOrigin: vi.fn(),
  rateLimit: vi.fn(),
  getClientIp: vi.fn(),
  testResultFind: vi.fn(),
  practiceAttemptFind: vi.fn(),
  practiceAttemptCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  connectDb,
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUserId,
}));

vi.mock("@/lib/security/request-guards", () => ({
  requireSameOrigin,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit,
  getClientIp,
}));

vi.mock("@/lib/models/TestResult", () => ({
  TestResult: {
    find: testResultFind,
  },
}));

vi.mock("@/lib/models/PracticeAttempt", () => ({
  PracticeAttempt: {
    find: practiceAttemptFind,
    create: practiceAttemptCreate,
  },
}));

import { GET as examResultsGet } from "@/app/api/exam/results/route";
import { GET as practiceGet, POST as practicePost } from "@/app/api/practice/attempts/route";

describe("protected routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    connectDb.mockResolvedValue(undefined);
    requireSameOrigin.mockReturnValue(null);
    rateLimit.mockResolvedValue(null);
    getClientIp.mockReturnValue("127.0.0.1");
  });

  it("rejects unauthenticated requests for protected APIs", async () => {
    getSessionUserId.mockResolvedValue(null);

    const examRes = await examResultsGet();
    expect(examRes.status).toBe(401);
    await expect(examRes.json()).resolves.toEqual({ error: "Unauthorized" });

    const practiceRes = await practiceGet();
    expect(practiceRes.status).toBe(401);
    await expect(practiceRes.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns validation error for invalid practice attempt request", async () => {
    getSessionUserId.mockResolvedValue("user-1");

    const res = await practicePost(
      new Request("http://localhost:3000/api/practice/attempts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          module: "reading",
          title: "",
          rawScore: -1,
          totalQuestions: 0,
        }),
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid practice attempt" });
  });
});
