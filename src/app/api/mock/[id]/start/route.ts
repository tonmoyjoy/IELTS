import { handler, json } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { startSection } from "@/server/services/mock";

export const POST = handler<RouteContext<"/api/mock/[id]/start">>("mock.start", async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `mock:user:${user.id}`, limit: 120, windowSeconds: 60 * 60 }]);
  const { id } = await ctx.params;
  return json({ mock: await startSection(user.id, id) });
});
