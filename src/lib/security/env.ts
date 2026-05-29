const SECURITY_ENV_PREFIX = "Security env misconfiguration:";

function fail(message: string): never {
  throw new Error(`${SECURITY_ENV_PREFIX} ${message}`);
}

function read(name: string) {
  return process.env[name]?.trim();
}

export function getJwtSecret() {
  const secret = read("JWT_SECRET");
  if (!secret) {
    fail("JWT_SECRET must be set.");
  }
  if (secret.length < 32) {
    fail("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function getRateLimitRedisConfig() {
  const url = read("UPSTASH_REDIS_REST_URL");
  const token = read("UPSTASH_REDIS_REST_TOKEN");

  if (!url && !token) return null;
  if (!url || !token) {
    fail("Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither.");
  }

  return { url, token };
}

export function getAiEvalProvider() {
  const provider = (read("AI_EVAL_PROVIDER") ?? "gemini").toLowerCase();
  if (provider !== "gemini" && provider !== "openai") {
    fail("AI_EVAL_PROVIDER must be either 'gemini' or 'openai'.");
  }
  return provider;
}

export function requireGeminiApiKey(context: string) {
  const key = read("GEMINI_API_KEY");
  if (!key) {
    fail(`GEMINI_API_KEY is required for ${context}.`);
  }
  return key;
}

export function requireOpenAiApiKey(context: string) {
  const key = read("OPENAI_API_KEY");
  if (!key) {
    fail(`OPENAI_API_KEY is required for ${context}.`);
  }
  return key;
}

export function isSecurityEnvError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith(SECURITY_ENV_PREFIX);
}

