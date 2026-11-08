import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { startCheckout } from "@/server/billing/payments";
import { BILLING_OPTION_IDS } from "@/lib/plans";

const bodySchema = z.object({
  optionId: z.enum(BILLING_OPTION_IDS),
  name: z.string().trim().min(2, "Enter your name.").max(60),
  // Bangladeshi mobile number: 01XXXXXXXXX, optionally with +88 / 88.
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number, e.g. 01712345678.")),
});

/** Creates a pending payment and returns the SSLCommerz hosted payment page URL. */
export const POST = handler("billing.checkout", async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `checkout:user:${user.id}`, limit: 10, windowSeconds: 60 * 60 }]);
  const body = await readJson(req, bodySchema);
  const { gatewayUrl } = await startCheckout({
    userId: user.id,
    email: user.email,
    optionId: body.optionId,
    name: body.name,
    phone: body.phone,
  });
  return json({ url: gatewayUrl });
});
