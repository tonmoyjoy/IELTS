import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { emailOnlySchema } from "@/server/auth/schemas";
import { normalizeEmail, resendVerification } from "@/server/services/auth";

export const POST = handler("auth.resend_verification", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `resend:ip:${ip}`, limit: 5, windowSeconds: 15 * 60 }]);

  const body = await readJson(req, emailOnlySchema);
  await enforceRateLimit([
    { key: `resend:email:${normalizeEmail(body.email)}`, limit: 3, windowSeconds: 60 * 60 },
  ]);

  await resendVerification(body.email);
  return json(
    { ok: true, message: "If that account still needs verifying, we sent a new link." },
    { status: 202 }
  );
});
