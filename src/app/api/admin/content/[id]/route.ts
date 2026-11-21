import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireAdminApi } from "@/server/auth/session";
import { deleteContent, getContent, publishContent, saveContent, unpublishContent } from "@/server/services/content-admin";
import { answersSchema, validateContent } from "@/server/content/validate";

/** Publishing a listening item renders its recording with Gemini TTS, which can take a couple of minutes. */
export const maxDuration = 300;

const editable = {
  payload: z.record(z.string(), z.unknown()),
  answers: answersSchema.optional(),
  script: z.unknown().optional(),
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), ...editable }),
  z.object({ action: z.literal("validate"), ...editable }),
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("delete") }),
]);

export const GET = handler<RouteContext<"/api/admin/content/[id]">>("admin.content.get", async (_req, ctx) => {
  await requireAdminApi();
  const { id } = await ctx.params;
  return json({ item: await getContent(id) });
});

export const POST = handler<RouteContext<"/api/admin/content/[id]">>("admin.content.update", async (req, ctx) => {
  assertSameOrigin(req);
  const admin = await requireAdminApi();
  await enforceRateLimit([{ key: `content:edit:${admin.id}`, limit: 300, windowSeconds: 60 * 60 }]);
  const { id } = await ctx.params;
  const body = await readJson(req, bodySchema, { maxBytes: 512 * 1024 });
  const actor = { id: admin.id, email: admin.email };
  switch (body.action) {
    case "validate": {
      const item = await getContent(id);
      const payload = { ...body.payload, id: item.slug };
      return json({ errors: validateContent(item.kind, item.slug, { payload, answers: body.answers, script: body.script }).errors });
    }
    case "save":
      return json({ item: await saveContent(actor, id, { payload: body.payload, answers: body.answers, script: (body.script ?? null) as never }) });
    case "publish":
      return json({ item: await publishContent(actor, id) });
    case "unpublish":
      return json({ item: await unpublishContent(actor, id) });
    case "delete":
      await deleteContent(actor, id);
      return json({ ok: true });
  }
});
