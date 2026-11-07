import { NextResponse } from "next/server";
import { handler, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { loginSchema } from "@/server/auth/schemas";
import { authenticate, normalizeEmail } from "@/server/services/auth";
import { signSessionToken } from "@/server/auth/jwt";
import { setSessionCookie } from "@/server/auth/cookie";

export const POST = handler("auth.login", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `login:ip:${ip}`, limit: 20, windowSeconds: 15 * 60 }]);

  const body = await readJson(req, loginSchema);
  await enforceRateLimit([
    { key: `login:email:${normalizeEmail(body.email)}`, limit: 10, windowSeconds: 15 * 60 },
  ]);

  const account = await authenticate(body.email, body.password);
  const token = await signSessionToken(account.id, account.tokenVersion);

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  setSessionCookie(res, token);
  return res;
});
