import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { ApiError } from "@/server/http/api";
import { AdminAuditLog } from "@/server/models/AdminAuditLog";
import { AudioClip } from "@/server/models/AudioClip";
import { ContentItem, type ContentKind, type ContentStatus } from "@/server/models/ContentItem";
import { BUILT_IN_IDS } from "@/server/content/catalog";
import { slugify, validateContent } from "@/server/content/validate";
import { draftContent, type DraftRequest } from "@/server/ai/content-drafter";
import { renderListening, renderSpeaking } from "@/server/audio/tts";
import { answerKeys, type AnswerKey } from "@/server/content/answer-keys";
import { getListeningScript, type ListeningScript } from "@/server/content/listening-scripts";
import { readingSets } from "@/content/reading";
import { listeningSets } from "@/content/listening";
import { writingTasks } from "@/content/writing";
import { speakingSets } from "@/content/speaking";
import { allQuestions, type ListeningSet, type QuestionGroup, type ReadingSet, type SpeakingSet } from "@/content/types";
import type { AdminActor } from "@/server/services/admin";

export type ContentRow = {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  status: ContentStatus;
  source: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ContentDetail = ContentRow & {
  payload: unknown;
  answers: Record<string, AnswerKey>;
  script: ListeningScript | null;
  brief: string | null;
  hasAudio: boolean;
  errors: string[];
};

type Lean = {
  _id: Types.ObjectId;
  kind: ContentKind;
  slug: string;
  title: string;
  status: ContentStatus;
  source: string;
  payload: unknown;
  answers?: Record<string, AnswerKey>;
  script?: ListeningScript | null;
  audio?: { listening?: string; speaking?: Record<string, string>; hash?: string };
  brief?: string | null;
  updatedAt: Date;
  publishedAt?: Date | null;
};

function toRow(doc: Lean): ContentRow {
  return {
    id: String(doc._id),
    kind: doc.kind,
    slug: doc.slug,
    title: doc.title,
    status: doc.status,
    source: doc.source,
    updatedAt: doc.updatedAt.toISOString(),
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
  };
}

async function audit(actor: AdminActor, action: string, item: { slug: string; kind: string }, note?: string) {
  await AdminAuditLog.create({
    admin: new Types.ObjectId(actor.id),
    adminEmail: actor.email,
    action,
    note: note?.slice(0, 500),
    details: { slug: item.slug, kind: item.kind },
  });
}

async function load(id: string): Promise<Lean> {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "CONTENT_NOT_FOUND", "That content item does not exist.");
  await connectDb();
  const doc = await ContentItem.findById(id).lean<Lean>();
  if (!doc) throw new ApiError(404, "CONTENT_NOT_FOUND", "That content item does not exist.");
  return doc;
}

/** A fresh slug that clashes with neither built-in content nor existing items. */
async function uniqueSlug(base: string): Promise<string> {
  const stem = slugify(base) || "practice";
  for (let i = 0; i < 5; i += 1) {
    const slug = `${stem.slice(0, 48)}-${randomBytes(2).toString("hex")}`;
    if (!BUILT_IN_IDS.has(slug) && !(await ContentItem.exists({ slug }))) return slug;
  }
  throw new ApiError(500, "SLUG_FAILED", "Could not create a unique id. Try again.");
}

export async function listContent(filter: { kind?: ContentKind; status?: ContentStatus } = {}): Promise<ContentRow[]> {
  await connectDb();
  const query: Record<string, unknown> = {};
  if (filter.kind) query.kind = filter.kind;
  if (filter.status) query.status = filter.status;
  const docs = await ContentItem.find(query).sort({ updatedAt: -1 }).limit(200).select("kind slug title status source updatedAt publishedAt").lean<Lean[]>();
  return docs.map(toRow);
}

export async function getContent(id: string): Promise<ContentDetail> {
  const doc = await load(id);
  return {
    ...toRow(doc),
    payload: doc.payload,
    answers: doc.answers ?? {},
    script: doc.script ?? null,
    brief: doc.brief ?? null,
    hasAudio: Boolean(doc.audio?.listening || (doc.audio?.speaking && Object.keys(doc.audio.speaking).length)),
    errors: validateContent(doc.kind, doc.slug, doc).errors,
  };
}

/** Gemini writes a first draft; it is saved unpublished for review. */
export async function createAiDraft(actor: AdminActor, request: DraftRequest): Promise<ContentDetail> {
  await connectDb();
  const slug = await uniqueSlug(request.topic);
  const draft = await draftContent(slug, request);
  if (draft.payload == null) throw new ApiError(502, "DRAFT_FAILED", draft.errors[0] ?? "The AI could not write a draft. Try again.");
  const doc = await ContentItem.create({
    kind: request.kind,
    slug,
    title: draft.title.slice(0, 200),
    payload: draft.payload,
    answers: draft.answers ?? {},
    script: draft.script ?? null,
    source: "ai",
    brief: [request.topic, request.notes].filter(Boolean).join(" — ").slice(0, 2000),
    createdBy: actor.email,
  });
  await audit(actor, "content.draft", { slug, kind: request.kind }, request.topic);
  return getContent(String(doc._id));
}

function renameQuestions(groups: QuestionGroup[], slug: string, keys: Record<string, AnswerKey>) {
  const answers: Record<string, AnswerKey> = {};
  const renamed = groups.map((group) => ({
    ...group,
    questions: group.questions.map((q) => {
      const id = `${slug}-${q.number}`;
      if (keys[q.id]) answers[id] = keys[q.id];
      return { ...q, id };
    }),
  }));
  return { groups: renamed, answers };
}

/** Starts a draft from a built-in set, as a template to edit. */
export async function duplicateBuiltIn(actor: AdminActor, kind: ContentKind, sourceId: string): Promise<ContentDetail> {
  await connectDb();
  const source =
    kind === "reading"
      ? readingSets.find((s) => s.id === sourceId)
      : kind === "listening"
        ? listeningSets.find((s) => s.id === sourceId)
        : kind === "writing"
          ? writingTasks.find((t) => t.id === sourceId)
          : speakingSets.find((s) => s.id === sourceId);
  if (!source) throw new ApiError(404, "CONTENT_NOT_FOUND", "That built-in set does not exist.");
  const slug = await uniqueSlug(`${source.title} copy`);
  let payload: unknown = { ...structuredClone(source), id: slug, title: `${source.title} (copy)` };
  let answers: Record<string, AnswerKey> = {};
  let script: ListeningScript | null = null;
  if (kind === "reading" || kind === "listening") {
    const renamed = renameQuestions((source as ReadingSet | ListeningSet).groups, slug, answerKeys);
    payload = { ...(payload as object), groups: renamed.groups, ...(kind === "listening" ? { audioSrc: "" } : {}) };
    answers = renamed.answers;
    if (kind === "listening") script = structuredClone(getListeningScript(sourceId) ?? null);
  }
  const doc = await ContentItem.create({
    kind,
    slug,
    title: `${source.title} (copy)`,
    payload,
    answers,
    script,
    source: "copy",
    createdBy: actor.email,
  });
  await audit(actor, "content.copy", { slug, kind }, sourceId);
  return getContent(String(doc._id));
}

/** Saves edits to a draft. Published items must be unpublished first, so live tests never change underneath a candidate. */
export async function saveContent(
  actor: AdminActor,
  id: string,
  input: { payload: unknown; answers?: Record<string, AnswerKey>; script?: ListeningScript | null }
): Promise<ContentDetail> {
  const doc = await load(id);
  if (doc.status === "published") throw new ApiError(409, "CONTENT_PUBLISHED", "Unpublish this item before editing it.");
  const payload = input.payload && typeof input.payload === "object" ? { ...(input.payload as Record<string, unknown>), id: doc.slug } : input.payload;
  const title = typeof (payload as { title?: unknown })?.title === "string" ? ((payload as { title: string }).title.slice(0, 200) || doc.title) : doc.title;
  await ContentItem.updateOne(
    { _id: doc._id },
    { $set: { payload, title, answers: input.answers ?? {}, script: doc.kind === "listening" ? (input.script ?? null) : null } }
  );
  await audit(actor, "content.save", doc);
  return getContent(id);
}

function audioHash(doc: Pick<Lean, "kind" | "payload" | "script">): string {
  const basis = doc.kind === "listening" ? doc.script : doc.kind === "speaking" ? doc.payload : null;
  return createHash("sha256").update(JSON.stringify(basis ?? null)).digest("hex").slice(0, 32);
}

/**
 * Publishes an item after it passes validation. Listening recordings and
 * examiner questions are rendered with Gemini TTS first (skipped when the
 * script has not changed since the last render).
 */
export async function publishContent(actor: AdminActor, id: string): Promise<ContentDetail> {
  const doc = await load(id);
  if (doc.status === "published") return getContent(id);
  const { errors } = validateContent(doc.kind, doc.slug, doc);
  if (errors.length) throw new ApiError(422, "CONTENT_INVALID", `Fix ${errors.length} problem(s) before publishing.`, { fields: { content: errors } });

  const ids = doc.kind === "reading" || doc.kind === "listening" ? allQuestions((doc.payload as ReadingSet).groups).map((q) => q.id) : [];
  const clash = ids.find((qid) => answerKeys[qid]);
  if (clash) throw new ApiError(422, "CONTENT_INVALID", `Question id ${clash} is already used by built-in content.`);

  const set: Record<string, unknown> = { status: "published", publishedAt: new Date() };
  const hash = audioHash(doc);
  if ((doc.kind === "listening" || doc.kind === "speaking") && doc.audio?.hash !== hash) {
    const old = [doc.audio?.listening, ...Object.values(doc.audio?.speaking ?? {})].filter(Boolean);
    if (doc.kind === "listening") {
      const clip = await renderListening(doc.slug, doc.script as ListeningScript);
      set.audio = { listening: clip, hash };
      set.payload = { ...(doc.payload as ListeningSet), audioSrc: `/api/audio/${clip}` };
    } else {
      set.audio = { speaking: await renderSpeaking(doc.payload as SpeakingSet), hash };
    }
    if (old.length) await AudioClip.deleteMany({ _id: { $in: old } });
  }
  const res = await ContentItem.updateOne({ _id: doc._id, status: { $ne: "published" } }, { $set: set });
  if (res.matchedCount === 0) return getContent(id);
  await audit(actor, "content.publish", doc);
  return getContent(id);
}

/** Takes an item off the site. Past attempts and mock tests keep their scores. */
export async function unpublishContent(actor: AdminActor, id: string): Promise<ContentDetail> {
  const doc = await load(id);
  await ContentItem.updateOne({ _id: doc._id }, { $set: { status: "draft" } });
  await audit(actor, "content.unpublish", doc);
  return getContent(id);
}

/** Deletes a draft that was never published (published items are only unpublished, so history stays intact). */
export async function deleteContent(actor: AdminActor, id: string): Promise<void> {
  const doc = await load(id);
  if (doc.publishedAt) throw new ApiError(409, "CONTENT_WAS_PUBLISHED", "This item has been published before. Unpublish it instead of deleting it.");
  const clips = [doc.audio?.listening, ...Object.values(doc.audio?.speaking ?? {})].filter(Boolean);
  if (clips.length) await AudioClip.deleteMany({ _id: { $in: clips } });
  await ContentItem.deleteOne({ _id: doc._id });
  await audit(actor, "content.delete", doc);
}
