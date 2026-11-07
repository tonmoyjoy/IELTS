import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { log } from "@/server/log";

/**
 * An error that is safe to show to the user. Anything else thrown inside a
 * route handler becomes a generic 500 and is logged/reported.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra?: {
      headers?: Record<string, string>;
      fields?: Record<string, string[]>;
    }
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiErrorBody = {
  error: string;
  code: string;
  fields?: Record<string, string[]>;
};

const NO_STORE = { "Cache-Control": "no-store" };

export function json<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: { ...NO_STORE, ...init?.headers },
  });
}

export function errorResponse(error: ApiError) {
  const body: ApiErrorBody = { error: error.message, code: error.code };
  if (error.extra?.fields) body.fields = error.extra.fields;
  return json(body, { status: error.status, headers: error.extra?.headers });
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Wraps a route handler: converts ApiError into a JSON error response and
 * any unexpected error into a logged, reported, generic 500.
 */
export function handler<Ctx = unknown>(name: string, fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status >= 500) log.error(`${name}.failed`, { code: error.code, error });
        return errorResponse(error);
      }
      log.error(`${name}.unhandled`, { error });
      Sentry.captureException(error, { tags: { route: name } });
      return errorResponse(new ApiError(500, "INTERNAL", "Something went wrong. Please try again."));
    }
  };
}

const MAX_JSON_BYTES = 64 * 1024;

/**
 * Reads and validates a JSON body. Rejects non-JSON content types (which also
 * blocks HTML-form CSRF), oversized bodies, malformed JSON and schema misses.
 */
export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  options: { maxBytes?: number } = {}
): Promise<z.infer<S>> {
  const maxBytes = options.maxBytes ?? MAX_JSON_BYTES;
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected an application/json request body.");
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "body";
      (fields[key] ??= []).push(issue.message);
    }
    throw new ApiError(400, "VALIDATION_FAILED", "Please check the highlighted fields.", { fields });
  }
  return parsed.data;
}
