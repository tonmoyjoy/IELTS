import { z } from "zod";
import { ApiError, handler, json, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { requireApiUser } from "@/server/auth/session";
import { releaseQuota, reserveQuota } from "@/server/billing/quota";
import { evaluateWriting, WRITING_PROMPT_VERSION } from "@/server/ai/writing";
import { AI_PROVIDER } from "@/server/ai/client";
import { toAiApiError } from "@/server/ai/errors";
import { createAttempt } from "@/server/services/attempts";
import { getEvaluationModel } from "@/server/env";
import { getWritingTask } from "@/content/writing";
import { countWords } from "@/lib/text";

export const maxDuration = 60;

/** Absolute floor so obviously empty submissions never cost an AI call. */
const MIN_WORDS_TO_SCORE = 50;

const bodySchema = z.object({
  taskId: z.string().min(1).max(80),
  answer: z.string().max(15_000, "Your answer is too long."),
});

/**
 * Scores a writing answer. The task prompt is looked up on the server by id,
 * so clients cannot substitute their own instructions to the examiner.
 */
export const POST = handler("writing.evaluate", async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await enforceRateLimit([{ key: `writing:user:${user.id}`, limit: 20, windowSeconds: 60 * 60 }]);

  const body = await readJson(req, bodySchema);
  const task = getWritingTask(body.taskId);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "That writing task does not exist.");

  const answer = body.answer.trim();
  const words = countWords(answer);
  if (words < MIN_WORDS_TO_SCORE) {
    throw new ApiError(400, "ANSWER_TOO_SHORT", `Write at least ${MIN_WORDS_TO_SCORE} words before asking for a score.`);
  }

  await reserveQuota(user.id, user.plan, "writing");
  const started = performance.now();
  try {
    const evaluation = await evaluateWriting(task, answer);
    const latencyMs = Math.round(performance.now() - started);
    const attempt = await createAttempt({
      userId: user.id,
      module: "writing",
      contentId: task.id,
      title: `Writing Task ${task.task}: ${task.title}`,
      score: evaluation.bandScore,
      summary: evaluation.summary,
      details: {
        taskId: task.id,
        answer,
        wordCount: evaluation.wordCount,
        underLength: evaluation.underLength,
        criteria: evaluation.criteria,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      },
      ai: { provider: AI_PROVIDER, model: getEvaluationModel(), promptVersion: WRITING_PROMPT_VERSION, latencyMs },
    });
    return json({ evaluation, attempt, latencyMs }, { status: 201 });
  } catch (error) {
    await releaseQuota(user.id, "writing").catch(() => {});
    throw toAiApiError(error, "writing.evaluate");
  }
});
