import { z } from "zod";
import { handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { completeSection } from "@/server/services/mock";
import { MOCK_ORDER } from "@/lib/mock";

const schema = z.object({
  section: z.enum(MOCK_ORDER),
  attemptIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(10),
});

export const POST = handler<RouteContext<"/api/mock/[id]/section">>("mock.section", async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `mock:user:${user.id}`, limit: 120, windowSeconds: 60 * 60 }]);
  const { id } = await ctx.params;
  const body = await readJson(req, schema);
  return json({ mock: await completeSection(user.id, id, body.section, body.attemptIds) });
});
