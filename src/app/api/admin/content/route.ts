import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireAdminApi } from "@/server/auth/session";
import { createAiDraft, duplicateBuiltIn } from "@/server/services/content-admin";
import { CONTENT_KINDS } from "@/server/models/ContentItem";

export const maxDuration = 300;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    kind: z.enum(CONTENT_KINDS),
    topic: z.string().trim().min(3).max(200),
    notes: z.string().trim().max(1000).optional(),
    variant: z.number().int().min(1).max(4).optional(),
  }),
  z.object({ action: z.literal("copy"), kind: z.enum(CONTENT_KINDS), sourceId: z.string().min(1).max(80) }),
]);

/** Creates a new draft: written by Gemini, or copied from a built-in set. */
export const POST = handler("admin.content.create", async (req) => {
  assertSameOrigin(req);
  const admin = await requireAdminApi();
  await enforceRateLimit([{ key: `content:create:${admin.id}`, limit: 120, windowSeconds: 60 * 60 }]);
  const body = await readJson(req, bodySchema);
  const actor = { id: admin.id, email: admin.email };
  if (body.action === "draft") {
    await enforceRateLimit([{ key: `content:draft:${admin.id}`, limit: 30, windowSeconds: 60 * 60 }]);
    return json({ item: await createAiDraft(actor, body) }, { status: 201 });
  }
  return json({ item: await duplicateBuiltIn(actor, body.kind, body.sourceId) }, { status: 201 });
});
