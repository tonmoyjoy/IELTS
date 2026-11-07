#!/usr/bin/env node
/**
 * Post-deploy smoke test. Read-only apart from one throwaway registration.
 *   BASE_URL=https://your-domain.com node scripts/smoke-auth.mjs
 */
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const origin = new URL(base).origin;
let failed = false;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}: ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

await check("health endpoint reports the database is up", async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  expect(res.ok && body.checks?.database === "up", `got ${res.status} ${JSON.stringify(body)}`);
});

await check("landing page sends a nonce-based CSP", async () => {
  const res = await fetch(base);
  expect(res.ok, `status ${res.status}`);
  expect(/'nonce-/.test(res.headers.get("content-security-policy") ?? ""), "missing CSP nonce");
});

await check("protected API rejects anonymous requests", async () => {
  expect((await fetch(`${base}/api/practice/attempts`)).status === 401, "expected 401");
});

await check("registration responds without leaking links", async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: `smoke+${Date.now()}@example.com`, password: "smoke-test-password" }),
  });
  const text = await res.text();
  expect(res.status === 202, `status ${res.status}: ${text}`);
  expect(!/token=|https?:\/\//.test(text), "response contains a link");
});

await check("cross-origin mutations are blocked", async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ email: "x@example.com", password: "x" }),
  });
  expect(res.status === 403, `expected 403, got ${res.status}`);
});

process.exit(failed ? 1 : 0);
