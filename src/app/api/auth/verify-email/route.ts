import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { tokenOnlySchema } from "@/server/auth/schemas";
import { verifyEmailToken } from "@/server/services/auth";

export const POST = handler("auth.verify_email", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `verify:ip:${ip}`, limit: 20, windowSeconds: 15 * 60 }]);

  const body = await readJson(req, tokenOnlySchema);
  await verifyEmailToken(body.token);
  return json({ ok: true, message: "Email verified. You can now sign in." });
});
