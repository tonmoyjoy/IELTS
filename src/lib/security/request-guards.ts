import { NextResponse } from "next/server";

function toOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return null;
    }
  }
}

function getForwardedOrigin(req: Request): string | null {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return toOrigin(`${proto}://${host}`);
}

function getAllowedOrigins(req: Request): Set<string> {
  const requestUrl = new URL(req.url);
  const origins = new Set<string>([requestUrl.origin]);

  const forwardedOrigin = getForwardedOrigin(req);
  if (forwardedOrigin) origins.add(forwardedOrigin);

  const appUrl = toOrigin(process.env.APP_URL);
  if (appUrl) origins.add(appUrl);

  const publicAppUrl = toOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (publicAppUrl) origins.add(publicAppUrl);

  const vercelUrl = toOrigin(process.env.VERCEL_URL);
  if (vercelUrl) origins.add(vercelUrl);

  for (const origin of process.env.ALLOWED_ORIGINS?.split(",") ?? []) {
    const parsed = toOrigin(origin);
    if (parsed) origins.add(parsed);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3001");
    origins.add("http://localhost:3100");
    origins.add("http://127.0.0.1:3100");
  }

  return origins;
}

export function requireSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  const parsedOrigin = toOrigin(origin);
  if (parsedOrigin && getAllowedOrigins(req).has(parsedOrigin)) return null;

  return NextResponse.json(
    { error: "Cross-origin request blocked. Add your deployed app URL to APP_URL or ALLOWED_ORIGINS." },
    { status: 403 }
  );
}

export function requireJson(req: Request): NextResponse | null {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return null;
  return NextResponse.json(
    { error: "Expected application/json request body" },
    { status: 400 }
  );
}
