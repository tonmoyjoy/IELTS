import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp } from "@/server/http/client-ip";
import { resetEnvCache } from "@/server/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const headers = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  it("uses the entry appended by the trusted proxy, not the client-supplied one", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("supports multiple trusted hops", () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "2");
    resetEnvCache();
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" }))).toBe("203.0.113.9");
  });

  it("never falls back to a spoofable entry when the chain is too short", () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "2");
    resetEnvCache();
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6" }))).toBe("unknown");
  });

  it("uses a configured single header exclusively", () => {
    vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
    resetEnvCache();
    expect(getClientIp(headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.7");
  });

  it("rejects values that are not IP addresses", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
    expect(getClientIp(headers({ "x-real-ip": "::1" }))).toBe("::1");
  });
});
