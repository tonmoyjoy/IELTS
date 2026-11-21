import "server-only";
import { connectDb } from "@/server/db";
import { ContentItem, type ContentKind } from "@/server/models/ContentItem";
import { answerKeys, type AnswerKey } from "@/server/content/answer-keys";
import { getListeningScript, type ListeningScript } from "@/server/content/listening-scripts";
import { readingSets } from "@/content/reading";
import { listeningSets } from "@/content/listening";
import { writingTasks } from "@/content/writing";
import { speakingSets } from "@/content/speaking";
import { examinerClipsFor } from "@/content/audio";
import type { ListeningSet, ReadingSet, SpeakingSet, WritingTask } from "@/content/types";

/**
 * Every piece of practice content the app can serve: the built-in sets in
 * `src/content` plus items published from the admin content editor.
 * Server-only; pages pass the public shapes to client components.
 */

type PayloadOf = { reading: ReadingSet; listening: ListeningSet; writing: WritingTask; speaking: SpeakingSet };

type PublishedRow = { slug: string; payload: unknown; answers?: Record<string, AnswerKey>; script?: ListeningScript | null; audio?: { speaking?: Record<string, string> } };

async function published<K extends ContentKind>(kind: K): Promise<PayloadOf[K][]> {
  await connectDb();
  const rows = await ContentItem.find({ kind, status: "published" }).sort({ publishedAt: 1 }).select("payload").lean<PublishedRow[]>();
  return rows.map((row) => row.payload as PayloadOf[K]);
}

async function publishedRow(kind: ContentKind, slug: string): Promise<PublishedRow | null> {
  await connectDb();
  return ContentItem.findOne({ kind, slug, status: "published" }).select("slug payload answers script audio").lean<PublishedRow>();
}

export const BUILT_IN_IDS = new Set<string>([
  ...readingSets.map((s) => s.id),
  ...listeningSets.map((s) => s.id),
  ...writingTasks.map((t) => t.id),
  ...speakingSets.map((s) => s.id),
]);

export async function listReading(): Promise<ReadingSet[]> {
  return [...readingSets, ...(await published("reading"))];
}
export async function listListening(): Promise<ListeningSet[]> {
  return [...listeningSets, ...(await published("listening"))];
}
export async function listWriting(): Promise<WritingTask[]> {
  return [...writingTasks, ...(await published("writing"))];
}
export async function listSpeaking(): Promise<SpeakingSet[]> {
  return [...speakingSets, ...(await published("speaking"))];
}

export async function findReading(id: string): Promise<ReadingSet | undefined> {
  return readingSets.find((s) => s.id === id) ?? ((await publishedRow("reading", id))?.payload as ReadingSet | undefined);
}
export async function findListening(id: string): Promise<ListeningSet | undefined> {
  return listeningSets.find((s) => s.id === id) ?? ((await publishedRow("listening", id))?.payload as ListeningSet | undefined);
}
export async function findWriting(id: string): Promise<WritingTask | undefined> {
  return writingTasks.find((t) => t.id === id) ?? ((await publishedRow("writing", id))?.payload as WritingTask | undefined);
}
export async function findSpeaking(id: string): Promise<SpeakingSet | undefined> {
  return speakingSets.find((s) => s.id === id) ?? ((await publishedRow("speaking", id))?.payload as SpeakingSet | undefined);
}

/** Answer keys for one reading or listening set (server-only). */
export async function answerKeysFor(module: "reading" | "listening", setId: string): Promise<Record<string, AnswerKey>> {
  if (BUILT_IN_IDS.has(setId)) return answerKeys;
  return (await publishedRow(module, setId))?.answers ?? {};
}

/** Listening transcript, revealed only after submission. */
export async function scriptFor(setId: string): Promise<ListeningScript | undefined> {
  return getListeningScript(setId) ?? (await publishedRow("listening", setId))?.script ?? undefined;
}

/** URLs of the examiner's recorded questions, keyed "welcome", "p1-0", "p2-cue"… */
export async function examinerClips(setId: string): Promise<Record<string, string>> {
  const common = Object.fromEntries(
    examinerClipsFor(setId).map((file) => [file.split("/").pop()!.replace(/\.mp3$/, ""), `/${file}`])
  );
  if (BUILT_IN_IDS.has(setId)) return common;
  const row = await publishedRow("speaking", setId);
  const own = Object.fromEntries(Object.entries(row?.audio?.speaking ?? {}).map(([key, clipId]) => [key, `/api/audio/${clipId}`]));
  return { ...common, ...own };
}
