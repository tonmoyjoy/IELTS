import { handler, json } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { createMock } from "@/server/services/mock";

/** Starts a new full mock test with randomly chosen writing and speaking topics. */
export const POST = handler("mock.create", async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `mock:create:${user.id}`, limit: 10, windowSeconds: 24 * 60 * 60 }]);
  const mock = await createMock(user.id, user.plan);
  return json({ mock }, { status: 201 });
});
