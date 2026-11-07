import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceRateLimit, memoryHit, resetMemoryRateLimits } from "@/server/security/rate-limit";
import { resetEnvCache } from "@/server/env";

beforeEach(() => resetMemoryRateLimits());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
});

describe("memory store", () => {
  it("counts within a window and resets after it", () => {
    const now = 1_000_000;
    expect(memoryHit("k", 60, now).count).toBe(1);
    expect(memoryHit("k", 60, now + 1000).count).toBe(2);
    expect(memoryHit("k", 60, now + 61_000).count).toBe(1);
  });
});

describe("enforceRateLimit", () => {
  it("allows up to the limit then throws 429 with Retry-After", async () => {
    const rule = { key: "login:ip:1", limit: 2, windowSeconds: 60 };
    await enforceRateLimit([rule]);
    await enforceRateLimit([rule]);
    const error = await enforceRateLimit([rule]).catch((e) => e);
    expect(error.status).toBe(429);
    expect(Number(error.extra.headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("uses an atomic Upstash pipeline when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    resetEnvCache();
    const fetchMock = vi.fn(async () => Response.json([{ result: 5 }, { result: 0 }, { result: 42 }]));
    vi.stubGlobal("fetch", fetchMock);

    const error = await enforceRateLimit([{ key: "k", limit: 4, windowSeconds: 60 }]).catch((e) => e);
    expect(error.status).toBe(429);
    expect(error.extra.headers["Retry-After"]).toBe("42");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://redis.example/pipeline");
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", "rl:k"],
      ["EXPIRE", "rl:k", "60", "NX"],
      ["TTL", "rl:k"],
    ]);
  });

  it("falls back to memory when Upstash is unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    resetEnvCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(enforceRateLimit([{ key: "k2", limit: 1, windowSeconds: 60 }])).resolves.toBeUndefined();
    await expect(enforceRateLimit([{ key: "k2", limit: 1, windowSeconds: 60 }])).rejects.toMatchObject({ status: 429 });
  });
});
