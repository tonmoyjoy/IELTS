import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { PracticeAttempt } from "@/lib/models/PracticeAttempt";
import { getSessionUserId } from "@/lib/auth/session";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/request-guards";

const attemptSchema = z.object({
  module: z.enum(["reading", "listening"]),
  title: z.string().min(1).max(120),
  rawScore: z.number().int().min(0),
  totalQuestions: z.number().int().min(1).max(40),
  summary: z.string().max(500).optional(),
  details: z.unknown().optional(),
});

function moduleAverages(attempts: Array<{ module: string; score: number }>) {
  return ["speaking", "writing", "reading", "listening"].map((module) => {
    const rows = attempts.filter((a) => a.module === module);
    const average =
      rows.length === 0
        ? null
        : Math.round((rows.reduce((sum, row) => sum + row.score, 0) / rows.length) * 10) / 10;
    return { module, attempts: rows.length, average };
  });
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDb();
  const attempts = await PracticeAttempt.find({ user: userId }).sort({ date: 1 }).lean();
  const cleanAttempts = attempts.map((attempt) => ({
    id: String(attempt._id),
    module: attempt.module,
    title: attempt.title,
    score: attempt.score,
    rawScore: attempt.rawScore,
    totalQuestions: attempt.totalQuestions,
    summary: attempt.summary,
    details: attempt.details,
    date: attempt.date,
  }));

  return NextResponse.json({
    attempts: cleanAttempts,
    analytics: {
      moduleAverages: moduleAverages(cleanAttempts),
      totalAttempts: cleanAttempts.length,
      latestScore: cleanAttempts.at(-1)?.score ?? null,
    },
  });
}

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimit(`practice:${userId}:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = attemptSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid practice attempt" }, { status: 400 });
  }

  const { module, title, rawScore, totalQuestions, summary, details } = parsed.data;
  const score = Math.round((rawScore / totalQuestions) * 9 * 2) / 2;

  await connectDb();
  const attempt = await PracticeAttempt.create({
    user: userId,
    module,
    title,
    score,
    rawScore,
    totalQuestions,
    summary,
    details,
  });

  return NextResponse.json({
    ok: true,
    attempt: {
      id: String(attempt._id),
      module: attempt.module,
      title: attempt.title,
      score: attempt.score,
      rawScore: attempt.rawScore,
      totalQuestions: attempt.totalQuestions,
      summary: attempt.summary,
      date: attempt.date,
    },
  });
}
