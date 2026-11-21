import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import * as createRoute from "@/app/api/mock/route";
import * as startRoute from "@/app/api/mock/[id]/start/route";
import * as sectionRoute from "@/app/api/mock/[id]/section/route";
import * as attempts from "@/app/api/practice/attempts/route";
import { MockTest } from "@/server/models/MockTest";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { Usage } from "@/server/models/Usage";
import { utcDayKey } from "@/server/billing/quota";
import { getListeningSet } from "@/content/listening";
import { getReadingSet } from "@/content/reading";
import { allQuestions } from "@/content/types";
import { answerKeys } from "@/server/content/answer-keys";
import { call } from "./helpers";
import { signInAs } from "./session-helpers";

type Mock = {
  id: string;
  section: string;
  status: string;
  deadline: string | null;
  listeningSetIds: string[];
  readingSetIds: string[];
  writingTaskIds: string[];
  speakingSetId: string;
  results: Record<string, { band: number; rawScore?: number; totalQuestions?: number; task1?: number; task2?: number; late: boolean }>;
  overall: number | null;
};

async function newMock(): Promise<Mock> {
  const res = await call(createRoute.POST, { json: {} });
  expect(res.status).toBe(201);
  return (res.body as { mock: Mock }).mock;
}

async function start(id: string): Promise<Mock> {
  const res = await call(startRoute.POST, { json: {}, params: { id } });
  expect(res.status).toBe(200);
  return (res.body as { mock: Mock }).mock;
}

function section(id: string, name: string, attemptIds: string[]) {
  return call(sectionRoute.POST, { json: { section: name, attemptIds }, params: { id } });
}

async function submitPerfect(module: "listening" | "reading", setId: string): Promise<string> {
  const set = module === "listening" ? getListeningSet(setId)! : getReadingSet(setId)!;
  const answers = Object.fromEntries(allQuestions(set.groups).map((q) => [q.id, answerKeys[q.id].accept[0]]));
  const res = await call(attempts.POST, { json: { module, setId, answers } });
  expect(res.status).toBe(201);
  return (res.body as { attempt: { id: string } }).attempt.id;
}

async function fakeAiAttempt(userId: string, module: "listening" | "writing" | "speaking", contentId: string, score: number) {
  const doc = await PracticeAttempt.create({ user: new Types.ObjectId(userId), module, contentId, title: "x", score, details: {} });
  return String(doc._id);
}

describe("full mock test", () => {
  it("runs all four sections in order and computes the overall band on the server", async () => {
    const userId = await signInAs("mock@example.com");
    let mock = await newMock();
    expect(mock).toMatchObject({ section: "listening", status: "in_progress", deadline: null });
    expect(mock.writingTaskIds).toHaveLength(2);

    // A section cannot be submitted before it starts.
    expect((await section(mock.id, "listening", [])).status).toBe(409);

    mock = await start(mock.id);
    expect(Date.parse(mock.deadline!) - Date.now()).toBeGreaterThan(39 * 60 * 1000);
    // Starting again never resets the clock.
    expect((await start(mock.id)).deadline).toBe(mock.deadline);

    const listeningIds = [];
    for (const setId of mock.listeningSetIds) listeningIds.push(await submitPerfect("listening", setId));
    expect((await section(mock.id, "listening", listeningIds.slice(0, 1))).status).toBe(400);
    let res = await section(mock.id, "listening", listeningIds);
    expect(res.status).toBe(200);
    mock = (res.body as { mock: Mock }).mock;
    expect(mock.section).toBe("reading");
    expect(mock.results.listening).toMatchObject({ band: 9, late: false });

    // Double submit of the same section is refused.
    expect((await section(mock.id, "listening", listeningIds)).status).toBe(409);

    await start(mock.id);
    const readingIds = [];
    for (const setId of mock.readingSetIds) readingIds.push(await submitPerfect("reading", setId));
    res = await section(mock.id, "reading", readingIds);
    expect(res.status).toBe(200);

    await start(mock.id);
    const task2 = await fakeAiAttempt(userId, "writing", mock.writingTaskIds[1], 7);
    // Task 1 skipped (under 50 words) counts as 0: (0 + 2 × 7) / 3 = 4.67 → 4.5
    res = await section(mock.id, "writing", [task2]);
    expect(res.status).toBe(200);
    mock = (res.body as { mock: Mock }).mock;
    expect(mock.results.writing).toMatchObject({ band: 4.5, task1: 0, task2: 7 });

    await start(mock.id);
    const speaking = await fakeAiAttempt(userId, "speaking", mock.speakingSetId, 6);
    res = await section(mock.id, "speaking", [speaking]);
    mock = (res.body as { mock: Mock }).mock;
    expect(mock.status).toBe("completed");
    // (9 + 9 + 4.5 + 6) / 4 = 7.125 → 7
    expect(mock.overall).toBe(7);
  });

  it("rejects attempts from before the section started, from other users, or for other content", async () => {
    const userId = await signInAs("cheater@example.com");
    const old = await fakeAiAttempt(userId, "listening", "sports-centre", 9);
    await PracticeAttempt.collection.updateOne({ _id: new Types.ObjectId(old) }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    const mock = await newMock();
    await start(mock.id);
    const others = await Promise.all(mock.listeningSetIds.slice(1).map((setId) => submitPerfect("listening", setId)));
    expect((await section(mock.id, "listening", [old, ...others])).status).toBe(400);

    const wrongModule = await fakeAiAttempt(userId, "speaking", mock.speakingSetId, 9);
    expect((await section(mock.id, "listening", [wrongModule, ...others])).status).toBe(400);

    const stranger = await fakeAiAttempt(String(new Types.ObjectId()), "listening", mock.listeningSetIds[0], 9);
    expect((await section(mock.id, "listening", [stranger, ...others])).status).toBe(400);

    await signInAs("someone-else@example.com");
    expect((await call(startRoute.POST, { json: {}, params: { id: mock.id } })).status).toBe(404);
    expect(await MockTest.countDocuments({})).toBe(1);
  });

  it("needs enough AI evaluations left today to start", async () => {
    const userId = await signInAs("busy@example.com");
    await Usage.create({ user: new Types.ObjectId(userId), day: utcDayKey(), writing: 2, speaking: 0 });
    const res = await call(createRoute.POST, { json: {} });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ code: "MOCK_QUOTA" });
  });

  it("requires a session and same-origin requests", async () => {
    expect((await call(createRoute.POST, { json: {} })).status).toBe(401);
    await signInAs("origin@example.com");
    expect((await call(createRoute.POST, { json: {}, headers: { origin: "https://evil.example" } })).status).toBe(403);
  });
});
