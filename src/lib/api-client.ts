/** Typed browser-side wrapper around the JSON API. Never throws for HTTP errors. */

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; code: string; fields?: Record<string, string[]> };

export async function apiFetch<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal } = {}
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch {
    return { ok: false, status: 0, error: "Network error. Check your connection and try again.", code: "NETWORK" };
  }

  const payload: unknown = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data: payload as T };

  const body = (payload ?? {}) as { error?: unknown; code?: unknown; fields?: unknown };
  return {
    ok: false,
    status: res.status,
    error: typeof body.error === "string" ? body.error : "Something went wrong. Please try again.",
    code: typeof body.code === "string" ? body.code : "UNKNOWN",
    fields: body.fields && typeof body.fields === "object" ? (body.fields as Record<string, string[]>) : undefined,
  };
}

export function firstFieldError(fields: Record<string, string[]> | undefined, name: string): string | undefined {
  return fields?.[name]?.[0];
}
