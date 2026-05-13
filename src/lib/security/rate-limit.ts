import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function redisRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): Promise<NextResponse | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const redisKey = `rate:${key}`;
  const windowSeconds = Math.ceil(options.windowMs / 1000);

  const incr = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!incr.ok) return null;

  const payload = (await incr.json()) as { result?: number };
  const count = Number(payload.result ?? 0);

  if (count === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => {});
  }

  if (count <= options.limit) return null;

  return NextResponse.json(
    { error: `Too many requests. Please wait before trying again.` },
    { status: 429, headers: { "Retry-After": String(windowSeconds) } }
  );
}

function memoryRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= options.limit) {
    return null;
  }

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return NextResponse.json(
    {
      error: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export async function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): Promise<NextResponse | null> {
  const redisResult = await redisRateLimit(key, options).catch(() => null);
  return redisResult ?? memoryRateLimit(key, options);
}
