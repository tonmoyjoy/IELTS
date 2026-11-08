# Security model

| Threat | Control | Where |
| --- | --- | --- |
| Account takeover via leaked links | Verification/reset links are only emailed, never returned by the API; tokens are 256-bit, stored as SHA-256 hashes, single-use and short-lived | `server/services/auth.ts` |
| Account enumeration | Identical responses for registration, reset and resend whether or not the email exists; constant-time bcrypt on unknown accounts | `server/services/auth.ts` |
| Stolen session after password change | JWT token version checked against the DB on every request; reset bumps it | `server/auth/session.ts` |
| CSRF | SameSite=Lax cookie + Origin allowlist / `Sec-Fetch-Site` check on every mutation + JSON-only bodies | `server/http/guards.ts`, `server/http/api.ts` |
| XSS | Nonce-based CSP with `strict-dynamic`, React escaping, HTML-escaped email templates | `proxy.ts`, `server/security/csp.ts` |
| Clickjacking / sniffing | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS | `next.config.ts` |
| Brute force / abuse | Per-IP and per-email rate limits (Upstash or memory), IP taken from trusted proxy hops only | `server/security/rate-limit.ts`, `server/http/client-ip.ts` |
| Score forgery | Answers graded on the server against server-only keys; client scores ignored | `server/practice/grading.ts` |
| AI prompt injection | System instruction separated from candidate text; tagged data blocks; schema-validated output; overall band derived on the server | `server/ai/*` |
| AI cost abuse | Recording length measured on the server; size limits; atomic daily quotas per plan; refunds only on provider failure | `app/api/speaking`, `server/billing/quota.ts` |
| Payment fraud | Prices set on the server; success only after SSLCommerz validation API confirms `tran_id`, amount and currency; idempotent claim so redirect + IPN grant Pro once; mismatches and high-risk payments held for review; callbacks rate-limited | `server/billing/payments.ts`, `server/billing/callbacks.ts` |
| Google sign-in | Authorization code + PKCE (S256), `state` and `nonce` in a signed 10-minute cookie, ID token verified against Google's JWKS (issuer, audience, expiry, `email_verified`) | `server/auth/google.ts` |
| Account pre-hijacking | Linking Google to an *unverified* account replaces its password and revokes its sessions | `server/services/auth.ts` |
| Admin access | `ADMIN_EMAILS` checked server-side on every request; non-admins (and anonymous users) get a real 404; mutations same-origin guarded and audit-logged | `server/auth/session.ts`, `server/services/admin.ts` |
| Credential leakage in URLs | Every form uses `method="post"`, so a page that isn't interactive yet never puts passwords in the address bar | auth forms |
| Open redirect | `from` parameter restricted to same-site relative paths | `lib/text.ts` |
| Secret leakage | Provider errors mapped to generic messages; health check reveals no configuration | `server/ai/errors.ts`, `app/api/health` |
| Misconfiguration | Production refuses to run without required secrets (32+ char JWT secret, DB, email, app URL) | `server/env.ts` |

Report vulnerabilities privately to the maintainers rather than opening a public issue.
