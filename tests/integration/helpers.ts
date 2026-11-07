import { cookieJar, outbox } from "./state";
import { sessionCookieName } from "@/server/auth/cookie";

type RouteFn = (req: Request, ctx: never) => Promise<Response>;

const ORIGIN = "http://localhost:3000";

export async function call(
  route: RouteFn,
  options: {
    method?: string;
    path?: string;
    json?: unknown;
    body?: BodyInit;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {}
): Promise<{ status: number; headers: Headers; body: Record<string, unknown> }> {
  const headers = new Headers({ origin: ORIGIN, ...options.headers });
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }
  const req = new Request(`${ORIGIN}${options.path ?? "/api/test"}`, {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body,
  });
  const res = await route(req, { params: Promise.resolve(options.params ?? {}) } as never);

  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const index = pair.indexOf("=");
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

export function lastEmailTo(email: string) {
  const message = [...outbox].reverse().find((m) => m.to === email);
  if (!message) throw new Error(`No email sent to ${email}`);
  return message;
}

export function tokenFromEmail(email: string, path: "verify-email" | "reset-password"): string {
  const match = lastEmailTo(email).text.match(new RegExp(`/${path}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${path} link in email to ${email}`);
  return match[1];
}

export function sessionCookie(): string | undefined {
  return cookieJar.get(sessionCookieName());
}

export { cookieJar, outbox };
