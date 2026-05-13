import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { PracticeAttempt } from "@/lib/models/PracticeAttempt";
import { getSessionUserId } from "@/lib/auth/session";
import {
  evaluateWriting,
  getWritingModelName,
  WRITING_PROMPT_VERSION,
} from "@/lib/ielts/evaluate-writing";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/request-guards";

const bodySchema = z.object({
  taskLabel: z.string().min(1).max(80),
  prompt: z.string().min(20).max(2000),
  answer: z.string().min(80).max(12000),
  minWords: z.number().int().min(100).max(300),
});

function getErrorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    return "Gemini quota is exhausted or temporarily limited. Wait a moment, use a fresh key/project, or enable billing.";
  }
  if (msg.toLowerCase().includes("api key")) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local, then restart the dev server.";
  }
  return "Writing evaluation failed. Please try again in a moment.";
}

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(`writing:${userId}:${getClientIp(req)}`, {
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid writing submission" }, { status: 400 });
  }

  const started = performance.now();
  try {
    const evaluation = await evaluateWriting(parsed.data);
    const latencyMs = Math.round(performance.now() - started);

    await connectDb();
    const attempt = await PracticeAttempt.create({
      user: userId,
      module: "writing",
      title: parsed.data.taskLabel,
      score: evaluation.bandScore,
      summary: evaluation.summary,
      details: {
        prompt: parsed.data.prompt,
        answer: parsed.data.answer,
        breakdown: evaluation.breakdown,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        wordCount: parsed.data.answer.trim().split(/\s+/).filter(Boolean).length,
      },
      ai: {
        provider: "gemini",
        model: getWritingModelName(),
        promptVersion: WRITING_PROMPT_VERSION,
        latencyMs,
      },
    });

    return NextResponse.json({
      ok: true,
      evaluation,
      attemptId: String(attempt._id),
      latencyMs,
    });
  } catch (e) {
    console.error("[api/writing/evaluate]", e);
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 502 });
  }
}
