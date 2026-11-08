import { z } from "zod";

/**
 * Central, validated access to environment variables.
 *
 * Validation is lazy (on first call) so `next build` can run without
 * production secrets. In production every required value is enforced the
 * first time any server code asks for config, so a misconfigured deploy
 * fails loudly on its first request instead of silently degrading.
 */

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const csv = optionalString.transform((value) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: optionalString,

    JWT_SECRET: optionalString,

    APP_URL: optionalString,
    ALLOWED_ORIGINS: csv,
    VERCEL_URL: optionalString,
    VERCEL_BRANCH_URL: optionalString,
    VERCEL_PROJECT_PRODUCTION_URL: optionalString,

    /** Number of trusted reverse proxies in front of the app (rightmost X-Forwarded-For entries they append). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /** Optional single header that carries the real client IP (e.g. "cf-connecting-ip" or "x-real-ip"). */
    CLIENT_IP_HEADER: optionalString,

    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: optionalString,
    GEMINI_TRANSCRIBE_MODEL: optionalString,

    RATE_LIMIT_STORE: z.enum(["memory", "upstash"]).optional(),
    UPSTASH_REDIS_REST_URL: optionalString,
    UPSTASH_REDIS_REST_TOKEN: optionalString,

    EMAIL_TRANSPORT: z.enum(["resend", "console"]).optional(),
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: optionalString,

    SENTRY_DSN: optionalString,

    SSLCOMMERZ_STORE_ID: optionalString,
    SSLCOMMERZ_STORE_PASSWORD: optionalString,
    SSLCOMMERZ_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
    /** Test-only override of the gateway host. */
    SSLCOMMERZ_BASE_URL: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const require = (key: keyof typeof env, message: string) =>
      ctx.addIssue({ code: "custom", path: [key], message });

    if (!env.MONGODB_URI) require("MONGODB_URI", "MONGODB_URI is required in production");
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      require("JWT_SECRET", "JWT_SECRET must be at least 32 characters in production");
    }
    if (!env.APP_URL) require("APP_URL", "APP_URL is required in production (e.g. https://your-domain.com)");

    const transport = env.EMAIL_TRANSPORT ?? (env.RESEND_API_KEY ? "resend" : undefined);
    if (!transport) {
      require(
        "EMAIL_TRANSPORT",
        "Configure RESEND_API_KEY and EMAIL_FROM, or set EMAIL_TRANSPORT=console explicitly (CI only)"
      );
    }
    if (transport === "resend" && (!env.RESEND_API_KEY || !env.EMAIL_FROM)) {
      require("RESEND_API_KEY", "RESEND_API_KEY and EMAIL_FROM are required when EMAIL_TRANSPORT=resend");
    }
    if (env.SSLCOMMERZ_MODE === "live" && (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD)) {
      require("SSLCOMMERZ_STORE_ID", "SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD are required when SSLCOMMERZ_MODE=live");
    }
    if (env.RATE_LIMIT_STORE === "upstash" && (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)) {
      require("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new EnvError(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test helper: forget the cached configuration so the next call re-reads process.env. */
export function resetEnvCache() {
  cached = null;
}

export function isProduction() {
  return getEnv().NODE_ENV === "production";
}

const DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me-0000";

export function getJwtSecret(): string {
  const env = getEnv();
  if (env.JWT_SECRET && env.JWT_SECRET.length >= 16) return env.JWT_SECRET;
  if (env.NODE_ENV === "production") {
    throw new EnvError("JWT_SECRET must be set");
  }
  return DEV_JWT_SECRET;
}

export function getAppUrl(): string {
  const env = getEnv();
  const base =
    env.APP_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export function getEmailTransport(): "resend" | "console" {
  const env = getEnv();
  if (env.EMAIL_TRANSPORT) return env.EMAIL_TRANSPORT;
  return env.RESEND_API_KEY && env.EMAIL_FROM ? "resend" : "console";
}

export function getRateLimitStore(): "memory" | "upstash" {
  const env = getEnv();
  if (env.RATE_LIMIT_STORE) return env.RATE_LIMIT_STORE;
  return env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "upstash" : "memory";
}

export const DEFAULT_EVALUATION_MODEL = "gemini-2.5-flash-lite";

export function getEvaluationModel(): string {
  return getEnv().GEMINI_MODEL ?? DEFAULT_EVALUATION_MODEL;
}

export function getTranscriptionModel(): string {
  const env = getEnv();
  return env.GEMINI_TRANSCRIBE_MODEL ?? env.GEMINI_MODEL ?? DEFAULT_EVALUATION_MODEL;
}
