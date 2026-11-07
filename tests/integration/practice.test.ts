import { describe, expect, it } from "vitest";
import * as attempts from "@/app/api/practice/attempts/route";
import * as attemptById from "@/app/api/practice/attempts/[id]/route";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { getReadingSet } from "@/content/reading";
import { getListeningSet } from "@/content/listening";
import { allQuestions } from "@/content/types";
import { answerKeys } from "@/server/content/answer-keys";
import { call, cookieJar } from "./helpers";
import { signInAs } from "./session-helpers";

const reading = getReadingSet("urban-green-spaces")!;
const perfect = Object.fromEntries(allQuestions(reading.groups).map((q) => [q.id, answerKeys[q.id].accept[0]]));

describe("practice attempts", () => {
  it("requires a session", async () => {
    expect((await call(attempts.GET)).status).toBe(401);
    expect((await call(attempts.POST, { json: { module: "reading", setId: reading.id, answers: {} } })).status).toBe(401);
  });

  it("grades on the server and ignores any client-supplied score", async () => {
    await signInAs("grader@example.com");
    const res = await call(attempts.POST, {
      json: { module: "reading", setId: reading.id, answers: { "ugs-1": "TRUE" }, rawScore: 12, score: 9, totalQuestions: 1 },
    });
    expect(res.status).toBe(201);
    const grade = res.body.grade as { rawScore: number; totalQuestions: number; band: number };
    expect(grade).toMatchObject({ rawScore: 1, totalQuestions: 12 });
    expect(grade.band).toBeLessThan(4);
    const stored = await PracticeAttempt.findOne({}).lean();
    expect(stored?.score).toBe(grade.band);
    expect(stored?.contentId).toBe(reading.id);
  });

  it("awards band 9 for a perfect paper and returns explanations", async () => {
    await signInAs("perfect@example.com");
    const res = await call(attempts.POST, { json: { module: "reading", setId: reading.id, answers: perfect } });
    const grade = res.body.grade as { band: number; results: Array<{ correct: boolean; explanation: string }> };
    expect(grade.band).toBe(9);
    expect(grade.results.every((r) => r.correct && r.explanation)).toBe(true);
  });

  it("returns the transcript only after a listening attempt is submitted", async () => {
    await signInAs("listener@example.com");
    const set = getListeningSet("sports-centre")!;
    const res = await call(attempts.POST, { json: { module: "listening", setId: set.id, answers: { "sc-1": "Beginner" } } });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.transcript)).toBe(true);
    expect((res.body.grade as { rawScore: number }).rawScore).toBe(1);
  });

  it("rejects unknown sets and malformed payloads", async () => {
    await signInAs("bad@example.com");
    expect((await call(attempts.POST, { json: { module: "reading", setId: "nope", answers: {} } })).status).toBe(404);
    expect((await call(attempts.POST, { json: { module: "writing", setId: reading.id, answers: {} } })).status).toBe(400);
    expect((await call(attempts.POST, { json: { module: "reading", setId: reading.id, answers: { a: "x".repeat(500) } } })).status).toBe(400);
  });

  it("paginates newest first and isolates users", async () => {
    await signInAs("pager@example.com");
    for (let i = 0; i < 3; i += 1) {
      await call(attempts.POST, { json: { module: "reading", setId: reading.id, answers: {} } });
    }
    const page1 = await call(attempts.GET, { path: "/api/practice/attempts?limit=2" });
    const list1 = page1.body.attempts as Array<{ id: string; date: string }>;
    expect(list1).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await call(attempts.GET, { path: `/api/practice/attempts?limit=2&before=${encodeURIComponent(String(page1.body.nextCursor))}` });
    expect((page2.body.attempts as unknown[]).length).toBe(1);
    expect(page2.body.nextCursor).toBeNull();

    const own = await call(attemptById.GET, { params: { id: list1[0].id } });
    expect(own.status).toBe(200);

    cookieJar.clear();
    await signInAs("snoop@example.com");
    expect((await call(attemptById.GET, { params: { id: list1[0].id } })).status).toBe(404);
    expect((await call(attemptById.GET, { params: { id: "not-an-id" } })).status).toBe(404);
    expect(((await call(attempts.GET)).body.attempts as unknown[]).length).toBe(0);
  });
});
