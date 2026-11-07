import { getEnv, getRateLimitStore } from "@/server/env";
import { ApiError } from "@/server/http/api";
import { log } from "@/server/log";

export type RateLimitRule = {
  /** Unique bucket key, e.g. `login:ip:1.2.3.4`. */
  key: string;
  limit: number;
  windowSeconds: number;
};

type Hit = { count: number; resetInSeconds: number };

// ---------------------------------------------------------------------------
// In-memory store (single instance: local dev, Docker, one VM).
// ---------------------------------------------------------------------------

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 50_000;

function sweep(now: number) {
  for (const [key, bucket] of memory) {
    if (bucket.resetAt <= now) memory.delete(key);
  }
}

export function memoryHit(key: string, windowSeconds: number, now = Date.now()): Hit {
  if (memory.size > MEMORY_MAX_KEYS) sweep(now);
  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { count: 1, resetInSeconds: windowSeconds };
  }
  existing.count += 1;
  return { count: existing.count, resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

/** Test helper. */
export function resetMemoryRateLimits() {
  memory.clear();
}

// ---------------------------------------------------------------------------
// Upstash Redis store (multi-instance / serverless).
// INCR + EXPIRE NX + TTL run in one pipeline so a key can never be left
// without an expiry.
// ---------------------------------------------------------------------------

async function upstashHit(key: string, windowSeconds: number): Promise<Hit> {
  const env = getEnv();
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
  const results = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(results[0]?.result);
  const ttl = Number(results[2]?.result);
  if (!Number.isFinite(count)) throw new Error("Upstash returned an invalid counter");
  return { count, resetInSeconds: ttl > 0 ? ttl : windowSeconds };
}

async function hit(rule: RateLimitRule): Promise<Hit> {
  const key = `rl:${rule.key}`;
  if (getRateLimitStore() === "upstash") {
    try {
      return await upstashHit(key, rule.windowSeconds);
    } catch (error) {
      // Fail open to the local limiter rather than locking every user out
      // while Redis is unavailable.
      log.warn("rate_limit.upstash_unavailable", { error });
    }
  }
  return memoryHit(key, rule.windowSeconds);
}

/**
 * Applies every rule and throws a 429 ApiError when any bucket is exhausted.
 */
export async function enforceRateLimit(rules: RateLimitRule[]): Promise<void> {
  for (const rule of rules) {
    const result = await hit(rule);
    if (result.count > rule.limit) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        `Too many requests. Please wait ${formatWait(result.resetInSeconds)} and try again.`,
        { headers: { "Retry-After": String(result.resetInSeconds) } }
      );
    }
  }
}

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
