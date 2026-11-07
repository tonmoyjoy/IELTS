import { handler, json } from "@/server/http/api";
import { requireApiUser } from "@/server/auth/session";
import { getUsageSummary } from "@/server/billing/quota";

export const GET = handler("auth.me", async () => {
  const user = await requireApiUser();
  const usage = await getUsageSummary(user.id, user.plan);
  return json({ user, usage });
});
