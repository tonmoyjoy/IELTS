import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { requireAdminApi } from "@/server/auth/session";
import { grantPro, revokePro } from "@/server/services/admin";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), days: z.number().int().min(1).max(730), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("revoke"), note: z.string().trim().max(500).optional() }),
]);

export const POST = handler<RouteContext<"/api/admin/users/[id]">>("admin.user", async (req, ctx) => {
  assertSameOrigin(req);
  const admin = await requireAdminApi();
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  const actor = { id: admin.id, email: admin.email };
  if (body.action === "grant") {
    const until = await grantPro(actor, id, body.days, body.note);
    return json({ ok: true, planExpiresAt: until ? until.toISOString() : null });
  }
  await revokePro(actor, id, body.note);
  return json({ ok: true });
});
