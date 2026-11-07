import { ApiError, handler, json } from "@/server/http/api";
import { requireApiUser } from "@/server/auth/session";
import { getAttempt } from "@/server/services/attempts";

export const GET = handler<RouteContext<"/api/practice/attempts/[id]">>("practice.get", async (_req, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const attempt = await getAttempt(user.id, id);
  if (!attempt) throw new ApiError(404, "NOT_FOUND", "Attempt not found.");
  return json({ attempt });
});
