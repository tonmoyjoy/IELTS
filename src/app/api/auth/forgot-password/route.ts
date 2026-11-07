import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { emailOnlySchema } from "@/server/auth/schemas";
import { normalizeEmail, requestPasswordReset } from "@/server/services/auth";

export const POST = handler("auth.forgot_password", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `forgot:ip:${ip}`, limit: 5, windowSeconds: 15 * 60 }]);

  const body = await readJson(req, emailOnlySchema);
  await enforceRateLimit([
    { key: `forgot:email:${normalizeEmail(body.email)}`, limit: 3, windowSeconds: 60 * 60 },
  ]);

  await requestPasswordReset(body.email);
  return json(
    { ok: true, message: "If an account exists for that email, we sent a password reset link." },
    { status: 202 }
  );
});
