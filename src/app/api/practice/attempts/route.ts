import { z } from "zod";
import { ApiError, handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { createAttempt, listAttempts } from "@/server/services/attempts";
import { gradeSet } from "@/server/practice/grading";
import { answerKeysFor, findListening, findReading, scriptFor } from "@/server/content/catalog";
import { isModule } from "@/lib/modules";

const submitSchema = z.object({
  module: z.enum(["reading", "listening"]),
  setId: z.string().min(1).max(80),
  answers: z
    .record(z.string().max(40), z.string().max(200))
    .refine((value) => Object.keys(value).length <= 60, { message: "Too many answers." }),
});

export const GET = handler("practice.list", async (req) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const moduleParam = url.searchParams.get("module");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : undefined;
  if (before && Number.isNaN(before.getTime())) {
    throw new ApiError(400, "INVALID_CURSOR", "Invalid pagination cursor.");
  }

  const result = await listAttempts(user.id, {
    module: isModule(moduleParam) ? moduleParam : undefined,
    contentId: url.searchParams.get("contentId") ?? undefined,
    limit: Number.isFinite(limit) ? limit : 20,
    before,
  });
  return json(result);
});

/**
 * Grades a reading or listening attempt on the server. The client sends only
 * its answers; the score is computed here from server-only answer keys.
 */
export const POST = handler("practice.submit", async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `practice:user:${user.id}`, limit: 60, windowSeconds: 60 * 60 }]);

  const body = await readJson(req, submitSchema);
  const set = body.module === "reading" ? await findReading(body.setId) : await findListening(body.setId);
  if (!set) throw new ApiError(404, "SET_NOT_FOUND", "That practice set does not exist.");

  const grade = gradeSet(body.module, set.groups, body.answers, await answerKeysFor(body.module, set.id));
  const transcript = body.module === "listening" ? ((await scriptFor(set.id))?.lines ?? []) : undefined;

  const attempt = await createAttempt({
    userId: user.id,
    module: body.module,
    contentId: set.id,
    title: set.title,
    score: grade.band,
    rawScore: grade.rawScore,
    totalQuestions: grade.totalQuestions,
    summary: `${grade.rawScore}/${grade.totalQuestions} correct`,
    details: { results: grade.results },
  });

  return json(
    {
      attempt,
      grade,
      transcript,
    },
    { status: 201 }
  );
});
