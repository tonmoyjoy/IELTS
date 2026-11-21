import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@/server/ai/client", () => ({
  AI_PROVIDER: "gemini",
  getGenAI: () => ({ models: { generateContent } }),
}));
const { renderListening, renderSpeaking } = vi.hoisted(() => ({ renderListening: vi.fn(), renderSpeaking: vi.fn() }));
vi.mock("@/server/audio/tts", () => ({ renderListening, renderSpeaking }));

import * as create from "@/app/api/admin/content/route";
import * as item from "@/app/api/admin/content/[id]/route";
import * as attempts from "@/app/api/practice/attempts/route";
import * as audio from "@/app/api/audio/[id]/route";
import { AudioClip } from "@/server/models/AudioClip";
import { ContentItem } from "@/server/models/ContentItem";
import { AdminAuditLog } from "@/server/models/AdminAuditLog";
import { listListening, listReading, listSpeaking } from "@/server/content/catalog";
import { resetEnvCache } from "@/server/env";
import { allQuestions, type ListeningSet, type ReadingSet } from "@/content/types";
import { readingSets } from "@/content/reading";
import { call } from "./helpers";
import { signInAs } from "./session-helpers";
import { rawReading } from "../support/content-fixtures";

type Item = { id: string; slug: string; status: string; errors: string[]; payload: unknown; answers: Record<string, { accept: string[] }>; script: unknown };

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "editor@example.com");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  resetEnvCache();
  generateContent.mockClear();
  generateContent.mockImplementation(async () => ({ text: "" }));
  renderListening.mockReset();
  renderSpeaking.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

async function copy(kind: string, sourceId: string): Promise<Item> {
  const res = await call(create.POST, { json: { action: "copy", kind, sourceId } });
  expect(res.status).toBe(201);
  return (res.body as { item: Item }).item;
}

function act(id: string, json: Record<string, unknown>) {
  return call(item.POST, { json, params: { id } });
}

describe("admin content editor", () => {
  it("is invisible to students", async () => {
    await signInAs("student@example.com");
    expect((await call(create.POST, { json: { action: "copy", kind: "reading", sourceId: readingSets[0].id } })).status).toBe(404);
  });

  it("copies a built-in set, publishes it, and students can take and be marked on it", async () => {
    await signInAs("editor@example.com");
    const draft = await copy("reading", readingSets[0].id);
    expect(draft.status).toBe("draft");
    expect(draft.errors).toEqual([]);
    const set = draft.payload as ReadingSet;
    expect(allQuestions(set.groups)[0].id).toBe(`${draft.slug}-1`);
    expect(await listReading()).toHaveLength(readingSets.length); // drafts are not live

    const published = await act(draft.id, { action: "publish" });
    expect(published.status).toBe(200);
    expect(await listReading()).toHaveLength(readingSets.length + 1);

    const perfect = Object.fromEntries(allQuestions(set.groups).map((q) => [q.id, draft.answers[q.id].accept[0]]));
    const res = await call(attempts.POST, { json: { module: "reading", setId: draft.slug, answers: perfect } });
    expect(res.status).toBe(201);
    expect((res.body as { grade: { band: number } }).grade.band).toBe(9);

    // Live tests can't be edited in place or deleted.
    expect((await act(draft.id, { action: "save", payload: set, answers: draft.answers })).status).toBe(409);
    expect((await act(draft.id, { action: "unpublish" })).status).toBe(200);
    expect((await call(attempts.POST, { json: { module: "reading", setId: draft.slug, answers: {} } })).status).toBe(404);
    expect((await act(draft.id, { action: "delete" })).status).toBe(409);
    // copy, publish, unpublish (the refused save and delete are not logged)
    expect(await AdminAuditLog.countDocuments({ action: { $regex: /^content\./ } })).toBe(3);
  });

  it("refuses to publish content with problems and reports them", async () => {
    await signInAs("editor@example.com");
    const draft = await copy("reading", readingSets[0].id);
    const set = draft.payload as ReadingSet;
    const textQuestion = allQuestions(set.groups).find((q) => q.kind === "text")!;
    const answers = { ...draft.answers, [textQuestion.id]: { display: "zebra", accept: ["zebra"], explanation: "Not in the passage." } };

    const check = await act(draft.id, { action: "validate", payload: set, answers });
    expect((check.body as { errors: string[] }).errors.join(" ")).toMatch(/zebra/);
    expect((await act(draft.id, { action: "save", payload: set, answers })).status).toBe(200);
    const publish = await act(draft.id, { action: "publish" });
    expect(publish.status).toBe(422);
    expect((publish.body as { fields: { content: string[] } }).fields.content.length).toBeGreaterThan(0);
    expect((await ContentItem.findById(draft.id).lean())?.status).toBe("draft");
    // A draft that was never published can be deleted.
    expect((await act(draft.id, { action: "delete" })).status).toBe(200);
  });

  it("drafts a reading test with Gemini and saves it unpublished", async () => {
    await signInAs("editor@example.com");
    const broken = structuredClone(rawReading);
    broken.groups[3].questions[0].answer = "moon"; // not in the passage
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(broken) }).mockResolvedValueOnce({ text: JSON.stringify(rawReading) });
    const res = await call(create.POST, { json: { action: "draft", kind: "reading", topic: "How bees navigate" } });
    expect(res.status).toBe(201);
    const draft = (res.body as { item: Item }).item;
    expect(draft.slug).toMatch(/^how-bees-navigate-[a-f0-9]{4}$/);
    expect(draft.status).toBe("draft");
    // The first draft had an unmarkable answer, so the AI was asked once more with the problem listed.
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].contents[0].parts[0].text).toContain("A previous attempt had these problems");
    expect(generateContent.mock.calls[1][0].contents[0].parts[0].text).toContain("moon");
    expect(draft.errors).toEqual([]);
    expect(await ContentItem.findOne({ slug: draft.slug }).lean()).toMatchObject({ source: "ai" });
  });

  it("records listening audio and examiner questions when publishing, and serves them with byte ranges", async () => {
    await signInAs("editor@example.com");
    const clip = await AudioClip.create({ data: Buffer.from("0123456789"), bytes: 10 });
    renderListening.mockResolvedValue(String(clip._id));
    renderSpeaking.mockResolvedValue({ "p1-0": String(clip._id) });

    const listening = await copy("listening", "sports-centre");
    expect((await act(listening.id, { action: "publish" })).status).toBe(200);
    expect(renderListening).toHaveBeenCalledTimes(1);
    const live = (await listListening()).find((s) => s.id === listening.slug) as ListeningSet;
    expect(live.audioSrc).toBe(`/api/audio/${clip._id}`);

    // Unpublish and republish without changing the script: the recording is reused.
    await act(listening.id, { action: "unpublish" });
    await act(listening.id, { action: "publish" });
    expect(renderListening).toHaveBeenCalledTimes(1);

    const speaking = await copy("speaking", "skills-and-learning");
    expect((await act(speaking.id, { action: "publish" })).status).toBe(200);
    expect((await listSpeaking()).some((s) => s.id === speaking.slug)).toBe(true);

    const full = await call(audio.GET, { method: "GET", params: { id: String(clip._id) } });
    expect(full.status).toBe(200);
    const partial = await call(audio.GET, { method: "GET", params: { id: String(clip._id) }, headers: { range: "bytes=2-4" } });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-4/10");
  });
});
