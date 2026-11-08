#!/usr/bin/env node
/**
 * Stand-in for Google's OAuth endpoints, used by the E2E tests:
 * consent page, token endpoint (returns an RS256 ID token) and JWKS.
 *   PORT=4601 CLIENT_ID=e2e-client node tests/support/fake-google.mjs
 */
import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

const PORT = Number(process.env.PORT ?? 4601);
const CLIENT_ID = process.env.CLIENT_ID ?? "e2e-client";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "fake-1", alg: "RS256", use: "sig" };
const codes = new Map(); // code -> { nonce, challenge, redirectUri, email, sub }

const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readForm = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(new URLSearchParams(data)));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/auth") {
    const p = url.searchParams;
    if (p.get("client_id") !== CLIENT_ID || p.get("code_challenge_method") !== "S256") {
      res.writeHead(400);
      return res.end("bad request");
    }
    const accounts = ["google.student@example.com", "e2e.student@example.com"];
    const links = accounts
      .map((email) => {
        const code = randomBytes(16).toString("hex");
        codes.set(code, { nonce: p.get("nonce"), challenge: p.get("code_challenge"), redirectUri: p.get("redirect_uri"), email, sub: `sub-${email}` });
        const back = new URL(p.get("redirect_uri"));
        back.searchParams.set("code", code);
        back.searchParams.set("state", p.get("state"));
        return `<p><a href="${escape(back)}">Sign in as ${escape(email)}</a></p>`;
      })
      .join("");
    const deny = new URL(p.get("redirect_uri"));
    deny.searchParams.set("error", "access_denied");
    deny.searchParams.set("state", p.get("state"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><body><h1>Fake Google</h1>${links}<p><a href="${escape(deny)}">Cancel</a></p></body></html>`);
  }

  if (req.method === "POST" && url.pathname === "/token") {
    const form = await readForm(req);
    const entry = codes.get(form.get("code"));
    codes.delete(form.get("code"));
    const verifierOk =
      entry && createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url") === entry.challenge;
    if (!entry || !verifierOk || form.get("client_id") !== CLIENT_ID || form.get("redirect_uri") !== entry.redirectUri) {
      return json(res, 400, { error: "invalid_grant" });
    }
    const idToken = await new SignJWT({ email: entry.email, email_verified: true, nonce: entry.nonce, name: "Test User" })
      .setProtectedHeader({ alg: "RS256", kid: "fake-1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(CLIENT_ID)
      .setSubject(entry.sub)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    return json(res, 200, { id_token: idToken, access_token: "fake", token_type: "Bearer", expires_in: 3600 });
  }

  if (url.pathname === "/certs") return json(res, 200, { keys: [jwk] });
  if (url.pathname === "/health") return json(res, 200, { ok: true });
  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => console.log(`fake Google on http://localhost:${PORT}`));
