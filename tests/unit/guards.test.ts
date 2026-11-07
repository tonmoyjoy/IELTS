import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin } from "@/server/http/guards";
import { ApiError } from "@/server/http/api";
import { resetEnvCache } from "@/server/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const req = (headers: Record<string, string>) => new Request("http://internal:3000/api/x", { method: "POST", headers });

function production() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MONGODB_URI", "mongodb://db/x");
  vi.stubEnv("JWT_SECRET", "y".repeat(40));
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("ALLOWED_ORIGINS", "https://www.example.com");
  vi.stubEnv("EMAIL_TRANSPORT", "console");
  resetEnvCache();
}

describe("assertSameOrigin", () => {
  it("accepts allowlisted origins", () => {
    production();
    expect(() => assertSameOrigin(req({ origin: "https://app.example.com" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ origin: "https://www.example.com" }))).not.toThrow();
  });

  it("rejects other origins even if forwarded headers are spoofed", () => {
    production();
    expect(() =>
      assertSameOrigin(req({ origin: "https://evil.example", "x-forwarded-host": "evil.example", host: "evil.example" }))
    ).toThrow(ApiError);
  });

  it("uses Sec-Fetch-Site when Origin is absent", () => {
    production();
    expect(() => assertSameOrigin(req({ "sec-fetch-site": "same-origin" }))).not.toThrow();
    expect(() => assertSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toThrow(ApiError);
  });

  it("rejects header-less requests in production but allows them in development", () => {
    production();
    expect(() => assertSameOrigin(req({}))).toThrow(ApiError);
    vi.unstubAllEnvs();
    resetEnvCache();
    expect(() => assertSameOrigin(req({}))).not.toThrow();
  });

  it("allows any localhost port outside production only", () => {
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3100" }))).not.toThrow();
    production();
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3100" }))).toThrow(ApiError);
  });
});
