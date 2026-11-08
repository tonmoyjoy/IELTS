import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { requireAdminApi } from "@/server/auth/session";
import { approvePayment, rejectPayment } from "@/server/services/admin";

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export const POST = handler<RouteContext<"/api/admin/payments/[id]">>("admin.payment", async (req, ctx) => {
  assertSameOrigin(req);
  const admin = await requireAdminApi();
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema);
  const actor = { id: admin.id, email: admin.email };
  if (body.action === "approve") await approvePayment(actor, id, body.note);
  else await rejectPayment(actor, id, body.note);
  return json({ ok: true });
});
