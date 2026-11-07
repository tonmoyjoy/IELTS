import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl, getEmailTransport, getJwtSecret, getRateLimitStore, parseEnv, resetEnvCache } from "@/server/env";

const prodBase = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://db/app",
  JWT_SECRET: "x".repeat(40),
  APP_URL: "https://app.example.com",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "Studio <hi@example.com>",
};

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("parseEnv", () => {
  it("accepts a complete production configuration", () => {
    expect(parseEnv(prodBase).APP_URL).toBe("https://app.example.com");
  });

  it.each([
    ["MONGODB_URI", { MONGODB_URI: undefined }],
    ["JWT_SECRET", { JWT_SECRET: "short" }],
    ["APP_URL", { APP_URL: "" }],
    ["EMAIL_TRANSPORT", { RESEND_API_KEY: undefined }],
  ])("rejects production config missing %s", (key, override) => {
    expect(() => parseEnv({ ...prodBase, ...override })).toThrow(key);
  });

  it("allows an explicit console email transport in production (CI)", () => {
    expect(() => parseEnv({ ...prodBase, RESEND_API_KEY: undefined, EMAIL_FROM: undefined, EMAIL_TRANSPORT: "console" })).not.toThrow();
  });

  it("requires Upstash credentials when that store is forced", () => {
    expect(() => parseEnv({ ...prodBase, RATE_LIMIT_STORE: "upstash" })).toThrow("UPSTASH");
  });

  it("is permissive in development and trims blanks", () => {
    const env = parseEnv({ NODE_ENV: "development", GEMINI_API_KEY: "   ", ALLOWED_ORIGINS: " https://a.com, ,https://b.com " });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.ALLOWED_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });
});

describe("derived settings", () => {
  it("falls back to safe development defaults", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    resetEnvCache();
    expect(getAppUrl()).toBe("http://localhost:3000");
    expect(getJwtSecret().length).toBeGreaterThanOrEqual(32);
    expect(getEmailTransport()).toBe("console");
    expect(getRateLimitStore()).toBe("memory");
  });
});
