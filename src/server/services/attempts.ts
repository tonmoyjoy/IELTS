import "server-only";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { MODULES, type IeltsModule } from "@/lib/modules";

export type AttemptSummary = {
  id: string;
  module: IeltsModule;
  contentId: string;
  title: string;
  score: number;
  rawScore: number | null;
  totalQuestions: number | null;
  summary: string | null;
  date: string;
};

export type AttemptDetail = AttemptSummary & {
  details: Record<string, unknown>;
};

export type NewAttempt = {
  userId: string;
  module: IeltsModule;
  contentId: string;
  title: string;
  score: number;
  rawScore?: number;
  totalQuestions?: number;
  summary?: string;
  details: Record<string, unknown>;
  ai?: {
    provider: string;
    model: string;
    transcriptionModel?: string;
    promptVersion: string;
    latencyMs: number;
  };
};

type LeanAttempt = {
  _id: Types.ObjectId;
  module: string;
  contentId?: string | null;
  title: string;
  score: number;
  rawScore?: number | null;
  totalQuestions?: number | null;
  summary?: string | null;
  date?: Date | null;
  details?: unknown;
};

function toSummary(doc: LeanAttempt): AttemptSummary {
  return {
    id: String(doc._id),
    module: doc.module as IeltsModule,
    contentId: doc.contentId ?? "",
    title: doc.title,
    score: doc.score,
    rawScore: doc.rawScore ?? null,
    totalQuestions: doc.totalQuestions ?? null,
    summary: doc.summary ?? null,
    date: (doc.date ?? new Date(0)).toISOString(),
  };
}

const SUMMARY_FIELDS = "module contentId title score rawScore totalQuestions summary date";

export async function createAttempt(input: NewAttempt): Promise<AttemptSummary> {
  await connectDb();
  const doc = await PracticeAttempt.create({
    user: new Types.ObjectId(input.userId),
    module: input.module,
    contentId: input.contentId,
    title: input.title,
    score: input.score,
    rawScore: input.rawScore,
    totalQuestions: input.totalQuestions,
    summary: input.summary?.slice(0, 2000),
    details: input.details,
    ai: input.ai,
  });
  return toSummary(doc.toObject() as LeanAttempt);
}

export async function listAttempts(
  userId: string,
  options: { module?: IeltsModule; contentId?: string; limit?: number; before?: Date } = {}
): Promise<{ attempts: AttemptSummary[]; nextCursor: string | null }> {
  await connectDb();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const filter: Record<string, unknown> = { user: new Types.ObjectId(userId) };
  if (options.module) filter.module = options.module;
  if (options.contentId) filter.contentId = options.contentId;
  if (options.before) filter.date = { $lt: options.before };

  const docs = (await PracticeAttempt.find(filter)
    .sort({ date: -1 })
    .limit(limit + 1)
    .select(SUMMARY_FIELDS)
    .lean()) as LeanAttempt[];

  const page = docs.slice(0, limit).map(toSummary);
  const nextCursor = docs.length > limit ? page[page.length - 1]?.date ?? null : null;
  return { attempts: page, nextCursor };
}

export async function getAttempt(userId: string, attemptId: string): Promise<AttemptDetail | null> {
  if (!Types.ObjectId.isValid(attemptId)) return null;
  await connectDb();
  const doc = (await PracticeAttempt.findOne({
    _id: new Types.ObjectId(attemptId),
    user: new Types.ObjectId(userId),
  })
    .select(`${SUMMARY_FIELDS} details`)
    .lean()) as LeanAttempt | null;
  if (!doc) return null;
  return {
    ...toSummary(doc),
    details: (doc.details && typeof doc.details === "object" ? doc.details : {}) as Record<string, unknown>,
  };
}

export type ModuleStats = {
  module: IeltsModule;
  attempts: number;
  average: number | null;
  best: number | null;
  latest: number | null;
};

export type ProgressStats = {
  totalAttempts: number;
  modules: ModuleStats[];
  /** Mean of the latest score in each practised module, rounded to a half band. */
  estimatedOverall: number | null;
  trend: Array<{ date: string; module: IeltsModule; score: number }>;
};

export async function getProgressStats(userId: string): Promise<ProgressStats> {
  await connectDb();
  const docs = (await PracticeAttempt.find({ user: new Types.ObjectId(userId) })
    .sort({ date: -1 })
    .limit(500)
    .select("module score date")
    .lean()) as Array<{ module: string; score: number; date?: Date | null }>;

  const modules: ModuleStats[] = MODULES.map((module) => {
    const rows = docs.filter((doc) => doc.module === module);
    if (rows.length === 0) return { module, attempts: 0, average: null, best: null, latest: null };
    const scores = rows.map((row) => row.score);
    const average = Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;
    return { module, attempts: rows.length, average, best: Math.max(...scores), latest: rows[0].score };
  });

  const latestScores = modules.map((m) => m.latest).filter((value): value is number => value != null);
  const estimatedOverall =
    latestScores.length === 0
      ? null
      : Math.round((latestScores.reduce((sum, value) => sum + value, 0) / latestScores.length) * 2 + 1e-9) / 2;

  const trend = docs
    .slice(0, 30)
    .reverse()
    .map((doc) => ({
      date: (doc.date ?? new Date(0)).toISOString(),
      module: doc.module as IeltsModule,
      score: doc.score,
    }));

  return { totalAttempts: docs.length, modules, estimatedOverall, trend };
}
