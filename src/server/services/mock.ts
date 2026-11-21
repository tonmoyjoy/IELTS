import "server-only";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { ApiError } from "@/server/http/api";
import { MockTest } from "@/server/models/MockTest";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { getUsageSummary } from "@/server/billing/quota";
import type { PlanId } from "@/lib/plans";
import { rawToBand } from "@/lib/bands";
import { MOCK_GRACE_SECONDS, MOCK_ORDER, MOCK_SECTION_SECONDS, nextSection, overallBand, writingBand, type MockSectionName } from "@/lib/mock";
import { listListening, listReading, listSpeaking, listWriting } from "@/server/content/catalog";

export type SectionResult = {
  band: number;
  attemptIds: string[];
  rawScore?: number;
  totalQuestions?: number;
  task1?: number;
  task2?: number;
  late: boolean;
  seconds: number;
};

export type MockView = {
  id: string;
  status: "in_progress" | "completed";
  section: MockSectionName | "done";
  sectionStartedAt: string | null;
  deadline: string | null;
  listeningSetIds: string[];
  readingSetIds: string[];
  writingTaskIds: string[];
  speakingSetId: string;
  results: Partial<Record<MockSectionName, SectionResult>>;
  overall: number | null;
  createdAt: string;
  completedAt: string | null;
};

type LeanMock = {
  _id: Types.ObjectId;
  status: "in_progress" | "completed";
  section: MockSectionName | "done";
  sectionStartedAt?: Date | null;
  listeningSetIds: string[];
  readingSetIds: string[];
  writingTaskIds: string[];
  speakingSetId: string;
  results?: Partial<Record<MockSectionName, SectionResult>>;
  overall?: number | null;
  createdAt: Date;
  completedAt?: Date | null;
};

function toView(doc: LeanMock): MockView {
  const started = doc.sectionStartedAt ?? null;
  const deadline = started && doc.section !== "done" ? new Date(started.getTime() + MOCK_SECTION_SECONDS[doc.section] * 1000) : null;
  return {
    id: String(doc._id),
    status: doc.status,
    section: doc.section,
    sectionStartedAt: started ? started.toISOString() : null,
    deadline: deadline ? deadline.toISOString() : null,
    listeningSetIds: doc.listeningSetIds,
    readingSetIds: doc.readingSetIds,
    writingTaskIds: doc.writingTaskIds,
    speakingSetId: doc.speakingSetId,
    results: doc.results ?? {},
    overall: doc.overall ?? null,
    createdAt: doc.createdAt.toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Chooses the papers for a new mock from all built-in and published content:
 * one listening recording per section (1–4) where available, three reading
 * passages, one Task 1, one Task 2 and one speaking topic.
 */
async function choosePapers() {
  const [listening, reading, writing, speaking] = await Promise.all([listListening(), listReading(), listWriting(), listSpeaking()]);
  const bySection = [1, 2, 3, 4].flatMap((section) => {
    const pool = listening.filter((set) => set.section === section);
    return pool.length ? [pickOne(pool)] : [];
  });
  // Fewer than three sections covered: top up with other recordings so the test still has three or four parts.
  const listeningSets = [...bySection, ...shuffle(listening.filter((s) => !bySection.includes(s)))].slice(0, Math.max(bySection.length, Math.min(3, listening.length)));
  listeningSets.sort((a, b) => a.section - b.section);
  return {
    listeningSetIds: listeningSets.map((set) => set.id),
    readingSetIds: shuffle(reading).slice(0, 3).map((set) => set.id),
    writingTaskIds: [pickOne(writing.filter((t) => t.task === 1)).id, pickOne(writing.filter((t) => t.task === 2)).id],
    speakingSetId: pickOne(speaking).id,
  };
}

/** AI evaluations a full mock needs: two writing tasks and one speaking test. */
export const MOCK_AI_NEEDS = { writing: 2, speaking: 1 } as const;

export async function createMock(userId: string, plan: PlanId): Promise<MockView> {
  const usage = await getUsageSummary(userId, plan);
  if (usage.features.writing.remaining < MOCK_AI_NEEDS.writing || usage.features.speaking.remaining < MOCK_AI_NEEDS.speaking) {
    throw new ApiError(
      402,
      "MOCK_QUOTA",
      `A full mock test needs ${MOCK_AI_NEEDS.writing} writing and ${MOCK_AI_NEEDS.speaking} speaking evaluations. You have ${usage.features.writing.remaining} and ${usage.features.speaking.remaining} left today.`
    );
  }
  await connectDb();
  const doc = await MockTest.create({ user: new Types.ObjectId(userId), ...(await choosePapers()) });
  return toView(doc.toObject() as LeanMock);
}

export async function getMock(userId: string, mockId: string): Promise<MockView | null> {
  if (!Types.ObjectId.isValid(mockId)) return null;
  await connectDb();
  const doc = await MockTest.findOne({ _id: mockId, user: new Types.ObjectId(userId) }).lean<LeanMock>();
  return doc ? toView(doc) : null;
}

export async function listMocks(userId: string, limit = 10): Promise<MockView[]> {
  await connectDb();
  const docs = await MockTest.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(limit).lean<LeanMock[]>();
  return docs.map(toView);
}

/** Starts the current section's clock. Idempotent: a running clock is never reset. */
export async function startSection(userId: string, mockId: string): Promise<MockView> {
  const mock = await getMock(userId, mockId);
  if (!mock) throw new ApiError(404, "MOCK_NOT_FOUND", "That mock test does not exist.");
  if (mock.section === "done") throw new ApiError(409, "MOCK_FINISHED", "This mock test is already finished.");
  await MockTest.updateOne({ _id: mockId, user: new Types.ObjectId(userId), section: mock.section, sectionStartedAt: null }, { $set: { sectionStartedAt: new Date() } });
  return (await getMock(userId, mockId))!;
}

type AttemptRow = { _id: Types.ObjectId; module: string; contentId: string; score: number; rawScore?: number; totalQuestions?: number; createdAt: Date };

/**
 * Records a finished section from attempts the user just created. Every
 * attempt must belong to the user, match the section and its assigned
 * content, and be created after the section started, so old attempts can't
 * be reused to inflate a mock score.
 */
export async function completeSection(userId: string, mockId: string, section: MockSectionName, attemptIds: string[]): Promise<MockView> {
  const mock = await getMock(userId, mockId);
  if (!mock) throw new ApiError(404, "MOCK_NOT_FOUND", "That mock test does not exist.");
  if (mock.section !== section) throw new ApiError(409, "MOCK_WRONG_SECTION", "This section has already been submitted.");
  if (!mock.sectionStartedAt) throw new ApiError(409, "MOCK_NOT_STARTED", "This section has not started.");

  const startedAt = new Date(mock.sectionStartedAt);
  const ids = [...new Set(attemptIds)].filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  const attempts = await PracticeAttempt.find({ _id: { $in: ids }, user: new Types.ObjectId(userId), module: section })
    .select("module contentId score rawScore totalQuestions createdAt")
    .lean<AttemptRow[]>();

  const allowed: Record<MockSectionName, string[]> = {
    listening: mock.listeningSetIds,
    reading: mock.readingSetIds,
    writing: mock.writingTaskIds,
    speaking: [mock.speakingSetId],
  };
  const expected = allowed[section];
  const byContent = new Map<string, AttemptRow>();
  for (const attempt of attempts) {
    // A few seconds of clock skew between app servers is tolerated.
    if (!expected.includes(attempt.contentId) || attempt.createdAt.getTime() < startedAt.getTime() - 5_000) {
      throw new ApiError(400, "MOCK_INVALID_ATTEMPT", "Those answers do not belong to this section.");
    }
    if (byContent.has(attempt.contentId)) throw new ApiError(400, "MOCK_INVALID_ATTEMPT", "Each part can be submitted once.");
    byContent.set(attempt.contentId, attempt);
  }
  if (attempts.length !== ids.length) throw new ApiError(400, "MOCK_INVALID_ATTEMPT", "Those answers do not belong to this section.");

  let result: Omit<SectionResult, "late" | "seconds" | "attemptIds">;
  if (section === "listening" || section === "reading") {
    if (byContent.size !== expected.length) throw new ApiError(400, "MOCK_INCOMPLETE", "Submit every part of this section.");
    const rawScore = [...byContent.values()].reduce((sum, a) => sum + (a.rawScore ?? 0), 0);
    const totalQuestions = [...byContent.values()].reduce((sum, a) => sum + (a.totalQuestions ?? 0), 0);
    result = { band: rawToBand(section, rawScore, totalQuestions), rawScore, totalQuestions };
  } else if (section === "writing") {
    // A task under 50 words can't be scored by the AI; it counts as band 0.
    const task1 = byContent.get(mock.writingTaskIds[0])?.score ?? 0;
    const task2 = byContent.get(mock.writingTaskIds[1])?.score ?? 0;
    result = { band: writingBand(task1, task2), task1, task2 };
  } else {
    const speaking = byContent.get(mock.speakingSetId);
    if (!speaking) throw new ApiError(400, "MOCK_INCOMPLETE", "Submit your speaking test.");
    result = { band: speaking.score };
  }

  const now = new Date();
  const seconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);
  const sectionResult: SectionResult = {
    ...result,
    attemptIds: attempts.map((a) => String(a._id)),
    seconds,
    late: seconds > MOCK_SECTION_SECONDS[section] + MOCK_GRACE_SECONDS,
  };
  const next = nextSection(section);
  const update: Record<string, unknown> = { [`results.${section}`]: sectionResult, section: next, sectionStartedAt: null };
  if (next === "done") {
    const bands = MOCK_ORDER.map((name) => (name === section ? sectionResult.band : mock.results[name]?.band ?? 0));
    Object.assign(update, { status: "completed", overall: overallBand(bands), completedAt: now });
  }
  // Compare-and-set on the section so a double submit records once.
  const res = await MockTest.updateOne({ _id: mockId, user: new Types.ObjectId(userId), section, sectionStartedAt: startedAt }, { $set: update });
  if (res.matchedCount === 0) throw new ApiError(409, "MOCK_WRONG_SECTION", "This section has already been submitted.");
  return (await getMock(userId, mockId))!;
}
