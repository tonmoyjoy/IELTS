import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { requireApiUser } from "@/server/auth/session";
import { updateTargetBand } from "@/server/services/auth";

const accountSchema = z.object({
  targetBand: z
    .number()
    .min(4)
    .max(9)
    .refine((value) => Number.isInteger(value * 2), { message: "Target band must be a whole or half band." }),
});

export const PATCH = handler("account.update", async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const body = await readJson(req, accountSchema);
  await updateTargetBand(user.id, body.targetBand);
  return json({ ok: true, targetBand: body.targetBand });
});
