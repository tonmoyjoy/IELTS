import { NextResponse } from "next/server";
import { handler, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { resetPasswordSchema } from "@/server/auth/schemas";
import { resetPassword } from "@/server/services/auth";
import { clearSessionCookie } from "@/server/auth/cookie";

export const POST = handler("auth.reset_password", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `reset:ip:${ip}`, limit: 10, windowSeconds: 15 * 60 }]);

  const body = await readJson(req, resetPasswordSchema);
  await resetPassword(body.token, body.password);

  // Every session was revoked; clear this browser's cookie too.
  const res = NextResponse.json(
    { ok: true, message: "Password updated. Sign in with your new password." },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(res);
  return res;
});
