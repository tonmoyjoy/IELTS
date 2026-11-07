/**
 * Content Security Policy with a per-request nonce for scripts.
 *
 * Styles allow 'unsafe-inline' because React renders `style` attributes
 * (progress bars, charts) server-side; inline style injection is far lower
 * risk than script injection, which stays nonce-only with 'strict-dynamic'.
 */
export function buildCsp(options: { nonce: string; isDev: boolean; sentryDsn?: string; upgradeInsecure?: boolean }): string {
  const connect = ["'self'"];
  if (options.sentryDsn) {
    try {
      connect.push(new URL(options.sentryDsn).origin);
    } catch {
      // ignore malformed DSN
    }
  }
  if (options.isDev) connect.push("ws:", "wss:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${options.nonce}'`, "'strict-dynamic'", ...(options.isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:"],
    "connect-src": connect,
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return options.upgradeInsecure ? `${policy}; upgrade-insecure-requests` : policy;
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
