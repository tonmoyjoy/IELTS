/**
 * Minimal structured logger. One JSON object per line so logs are greppable
 * locally and parseable by any hosted log drain (Vercel, Docker, Datadog...).
 */

type Level = "debug" | "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry: Record<string, unknown> = {
    level,
    event,
    time: new Date().toISOString(),
    ...fields,
  };
  if (fields && "error" in fields) entry.error = serializeError(fields.error);
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
