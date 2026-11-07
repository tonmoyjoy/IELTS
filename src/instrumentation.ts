import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error monitoring. Sentry stays completely off until SENTRY_DSN
 * is set, so local development and CI never send data anywhere.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
  });
}

export const onRequestError = Sentry.captureRequestError;
