/**
 * Smoke test: register → me (cookie) → login → logout.
 * Requires: MongoDB reachable at MONGODB_URI, app running (e.g. npm run dev).
 *
 *   set BASE_URL=http://127.0.0.1:3000 && node scripts/smoke-auth.mjs
 */
const base = process.env.BASE_URL || "http://127.0.0.1:3000";

function readSetCookieLines(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeSetCookies(jar, res) {
  for (const line of readSetCookieLines(res)) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name === "auth_token" && value === "") {
      jar.delete("auth_token");
    } else if (name && value) {
      jar.set(name, value);
    }
  }
}

async function main() {
  const email = `smoke_${Date.now()}@example.com`;
  const password = "password12345";

  const jar = new Map();

  async function fetchWithJar(path, opts = {}) {
    const headers = new Headers(opts.headers);
    if (jar.size) {
      headers.set(
        "Cookie",
        [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
      );
    }
    const res = await fetch(`${base}${path}`, { ...opts, headers });
    mergeSetCookies(jar, res);
    return res;
  }

  console.log("BASE_URL", base);

  let res = await fetchWithJar("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  let text = await res.text();
  console.log("POST /api/auth/register", res.status, text.slice(0, 200));
  if (!res.ok) process.exit(1);

  res = await fetchWithJar("/api/auth/me");
  text = await res.text();
  console.log("GET /api/auth/me", res.status, text);
  if (!res.ok) process.exit(1);

  jar.clear();

  res = await fetchWithJar("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  text = await res.text();
  console.log("POST /api/auth/login", res.status, text.slice(0, 200));
  if (!res.ok) process.exit(1);

  res = await fetchWithJar("/api/auth/logout", { method: "POST" });
  text = await res.text();
  console.log("POST /api/auth/logout", res.status, text);

  res = await fetchWithJar("/api/auth/me");
  console.log("GET /api/auth/me after logout", res.status, await res.text());

  console.log("smoke-auth: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
