import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { getClientIp } from "@/server/http/client-ip";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { registerSchema } from "@/server/auth/schemas";
import { normalizeEmail, registerAccount } from "@/server/services/auth";

export const POST = handler("auth.register", async (req) => {
  assertSameOrigin(req);
  const ip = getClientIp(req.headers);
  await enforceRateLimit([{ key: `register:ip:${ip}`, limit: 10, windowSeconds: 60 * 60 }]);

  const body = await readJson(req, registerSchema);
  await enforceRateLimit([
    { key: `register:email:${normalizeEmail(body.email)}`, limit: 3, windowSeconds: 60 * 60 },
  ]);

  await registerAccount(body.email, body.password);
  return json(
    {
      ok: true,
      message: "Check your inbox. We sent a link to verify your email address.",
    },
    { status: 202 }
  );
});
