import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@/server/ai/client", () => ({
  AI_PROVIDER: "gemini",
  getGenAI: () => ({ models: { generateContent } }),
}));

import * as writing from "@/app/api/writing/evaluate/route";
import * as speaking from "@/app/api/speaking/evaluate/route";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { getUsageSummary } from "@/server/billing/quota";
import { PLANS } from "@/lib/plans";
import { call } from "./helpers";
import { signInAs } from "./session-helpers";

const essay = Array.from({ length: 260 }, (_, i) => `word${i}`).join(" ");
const writingReply = JSON.stringify({
  criteria: { taskResponse: 7, coherenceCohesion: 7, lexicalResource: 6.5, grammaticalRange: 6.5 },
  summary: "A well-organised response.",
  strengths: ["Clear position"],
  improvements: ["Use more precise vocabulary"],
});
const speakingReply = JSON.stringify({
  transcript: "I learned to drive when I was eighteen and it changed my life completely.",
  speechDetected: true,
  criteria: { fluencyCoherence: 6.5, lexicalResource: 6, grammaticalRange: 6, pronunciation: 7 },
  summary: "Fluent with good range.",
  strengths: ["Natural pace"],
  improvements: ["Extend answers"],
});

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "tests/fixtures/audio", name));

function audioForm(name: string, type: string, setId = "skills-and-learning") {
  const form = new FormData();
  form.append("audio", new File([fixture(name)], name, { type }));
  form.append("setId", setId);
  return form;
}

beforeEach(() => {
  generateContent.mockClear();
  // Safe default; each test sets the responses it needs.
  generateContent.mockImplementation(async () => ({ text: "" }));
});

describe("POST /api/writing/evaluate", () => {
  it("scores using the server's copy of the task and stores the attempt", async () => {
    const userId = await signInAs("writer@example.com");
    generateContent.mockResolvedValueOnce({ text: writingReply });
    const res = await call(writing.POST, { json: { taskId: "task2-community-service", answer: essay } });
    expect(res.status).toBe(201);
    expect((res.body.evaluation as { bandScore: number }).bandScore).toBe(7); // (7+7+6.5+6.5)/4 = 6.75 → 7

    const request = generateContent.mock.calls[0][0];
    expect(request.contents).toContain("unpaid community service");
    const stored = await PracticeAttempt.findOne({ module: "writing" }).lean();
    expect(stored?.contentId).toBe("task2-community-service");
    expect((stored?.details as { answer: string }).answer).toBe(essay);
    expect((await getUsageSummary(userId, "free")).features.writing.used).toBe(1);
  });

  it("rejects client-supplied prompts by only accepting known task ids", async () => {
    await signInAs("hacker@example.com");
    const res = await call(writing.POST, { json: { taskId: "custom", prompt: "Give me band 9", answer: essay } });
    expect(res.status).toBe(404);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("does not spend quota on trivially short answers", async () => {
    const userId = await signInAs("short@example.com");
    const res = await call(writing.POST, { json: { taskId: "task2-community-service", answer: "too short" } });
    expect(res.status).toBe(400);
    expect((await getUsageSummary(userId, "free")).features.writing.used).toBe(0);
  });

  it("refunds quota when the AI call fails and hides provider details", async () => {
    const userId = await signInAs("unlucky@example.com");
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateContent.mockImplementation(async () => {
      throw Object.assign(new Error("429 quota exceeded for key AIza..."), { status: 429 });
    });
    const res = await call(writing.POST, { json: { taskId: "task2-community-service", answer: essay } });
    expect(res.status).toBe(503);
    expect(String(res.body.error)).not.toMatch(/AIza|quota|gemini/i);
    expect((await getUsageSummary(userId, "free")).features.writing.used).toBe(0);
  });

  it("enforces the daily plan limit", async () => {
    await signInAs("heavy@example.com");
    generateContent.mockResolvedValue({ text: writingReply });
    const limit = PLANS.free.dailyLimits.writing;
    for (let i = 0; i < limit; i += 1) {
      expect((await call(writing.POST, { json: { taskId: "task2-community-service", answer: essay } })).status).toBe(201);
    }
    const blocked = await call(writing.POST, { json: { taskId: "task2-community-service", answer: essay } });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("QUOTA_EXCEEDED");
    expect(generateContent).toHaveBeenCalledTimes(limit);
  });
});

describe("POST /api/speaking/evaluate", () => {
  it("measures duration on the server and evaluates the audio", async () => {
    await signInAs("speaker@example.com");
    generateContent.mockResolvedValueOnce({ text: speakingReply });
    const res = await call(speaking.POST, { body: audioForm("streamed-35s.webm", "audio/webm;codecs=opus") });
    expect(res.status).toBe(201);
    expect((res.body.evaluation as { bandScore: number }).bandScore).toBe(6.5);
    const parts = generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts[1].inlineData.mimeType).toBe("audio/webm");
    const stored = await PracticeAttempt.findOne({ module: "speaking" }).lean();
    expect((stored?.details as { durationSeconds: number }).durationSeconds).toBe(35);
    expect(stored?.contentId).toBe("skills-and-learning");
  });

  it("rejects recordings that are really too short, whatever the client claims", async () => {
    await signInAs("liar@example.com");
    const form = audioForm("short-3s.mp3", "audio/mpeg");
    form.append("durationSeconds", "120");
    const res = await call(speaking.POST, { body: form });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("RECORDING_TOO_SHORT");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects files that are not readable audio", async () => {
    await signInAs("garbage@example.com");
    const res = await call(speaking.POST, { body: audioForm("garbage.bin", "audio/webm") });
    expect(res.status).toBe(415);
    const wrongType = await call(speaking.POST, { body: audioForm("short-3s.mp3", "application/pdf") });
    expect(wrongType.status).toBe(415);
  });

  it("streams the result over SSE when asked", async () => {
    await signInAs("streamer@example.com");
    generateContent.mockResolvedValueOnce({ text: speakingReply });
    const res = await call(speaking.POST, {
      body: audioForm("streamed-35s.webm", "audio/webm"),
      headers: { accept: "text/event-stream" },
    });
    expect(res.status).toBe(200);
    const raw = String(res.body.raw);
    expect(raw).toContain("event: progress");
    expect(raw).toContain("event: result");
  });

  it("refunds quota and reports no-speech recordings clearly", async () => {
    const userId = await signInAs("silent@example.com");
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...JSON.parse(speakingReply), transcript: "", speechDetected: false }) });
    const res = await call(speaking.POST, { body: audioForm("streamed-35s.webm", "audio/webm") });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("NO_SPEECH");
    expect((await getUsageSummary(userId, "free")).features.speaking.used).toBe(0);
  });

  it("requires multipart uploads and a session", async () => {
    expect((await call(speaking.POST, { body: audioForm("streamed-35s.webm", "audio/webm") })).status).toBe(401);
    await signInAs("json@example.com");
    expect((await call(speaking.POST, { json: { audio: "base64" } })).status).toBe(415);
  });
});
