import "server-only";
import { z } from "zod";
import { allQuestions, type ListeningSet, type QuestionGroup, type ReadingSet, type SpeakingSet, type WritingTask } from "@/content/types";
import type { AnswerKey } from "@/server/content/answer-keys";
import type { ListeningScript } from "@/server/content/listening-scripts";
import { normalizeAnswer } from "@/server/practice/grading";
import { countWords } from "@/lib/text";
import type { ContentKind } from "@/server/models/ContentItem";

/**
 * Checks admin-created content before it can be published: the shape must
 * match what the test screens expect, and every answer must be markable
 * (the same rules as tests/unit/content-integrity.test.ts).
 */

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{1,78}$/, "use lowercase letters, numbers and hyphens");
const text = (max: number) => z.string().trim().min(1).max(max);

const choiceOption = z.object({ value: text(20), label: text(300) });
const question = z.discriminatedUnion("kind", [
  z.object({ id, number: z.number().int().min(1), kind: z.literal("choice"), prompt: text(600), options: z.array(choiceOption).min(2).max(12) }),
  z.object({
    id,
    number: z.number().int().min(1),
    kind: z.literal("text"),
    prompt: text(600),
    maxWords: z.number().int().min(1).max(5),
    allowNumber: z.boolean(),
  }),
]);
const groups = z.array(z.object({ range: text(40), instructions: text(1000), questions: z.array(question).min(1) })).min(1).max(6);

export const readingSchema = z.object({
  id,
  title: text(120),
  summary: text(300),
  recommendedMinutes: z.number().int().min(10).max(30),
  passage: z.object({ heading: text(200), paragraphs: z.array(z.object({ label: text(3), text: text(4000) })).min(3).max(12) }),
  groups,
});

export const listeningSchema = z.object({
  id,
  title: text(120),
  summary: text(300),
  section: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  audioSrc: z.string().max(200),
  groups,
});

export const scriptSchema = z.object({
  intro: text(600).optional(),
  voices: z.record(z.string().regex(/^[A-Z]$/), z.enum(["male", "female"])),
  lines: z.array(z.object({ speaker: z.string().regex(/^[A-Z]$/), text: text(1500) })).min(4).max(120),
});

const lineChart = z.object({
  kind: z.literal("line-chart"),
  title: text(200),
  xLabel: text(60),
  yLabel: text(60),
  unit: z.string().max(10),
  categories: z.array(text(30)).min(3).max(12),
  series: z.array(z.object({ name: text(60), values: z.array(z.number()) })).min(2).max(5),
});
const process = z.object({ kind: z.literal("process"), title: text(200), steps: z.array(z.object({ title: text(80), detail: text(300) })).min(4).max(12) });

export const writingSchema = z.object({
  id,
  task: z.union([z.literal(1), z.literal(2)]),
  title: text(120),
  minutes: z.number().int(),
  minWords: z.number().int(),
  prompt: text(2000),
  question: text(600).optional(),
  visual: z.discriminatedUnion("kind", [lineChart, process]).optional(),
});

export const speakingSchema = z.object({
  id,
  title: text(120),
  part1: z.array(text(300)).min(3).max(8),
  part2: z.object({ cue: text(300), bullets: z.array(text(200)).min(3).max(5) }),
  part3: z.array(text(300)).min(3).max(8),
});

export const answerKeySchema = z.object({ display: text(200), accept: z.array(text(100)).min(1).max(8), explanation: text(1000) });
export const answersSchema = z.record(z.string(), answerKeySchema);

export type ContentDraft = { payload: unknown; answers?: unknown; script?: unknown };
export type ValidationResult = { errors: string[] };

function zodErrors(prefix: string, error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map((issue) => `${prefix}${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`);
}

function checkQuestions(groupsValue: QuestionGroup[], answers: Record<string, AnswerKey>, source: string, errors: string[]) {
  const questions = allQuestions(groupsValue);
  if (questions.length < 5 || questions.length > 40) errors.push(`Needs 5–40 questions (has ${questions.length}).`);
  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) errors.push("Question ids must be unique.");
  questions.forEach((q, index) => {
    if (q.number !== index + 1) errors.push(`Question ${q.id}: number should be ${index + 1}.`);
  });
  const normalizedSource = normalizeAnswer(source);
  for (const q of questions) {
    const key = answers[q.id];
    if (!key) {
      errors.push(`Question ${q.number}: missing answer.`);
      continue;
    }
    if (q.kind === "choice") {
      const values = new Set(q.options.map((o) => o.value));
      if (new Set(q.options.map((o) => o.value)).size !== q.options.length) errors.push(`Question ${q.number}: option values must be unique.`);
      for (const accepted of key.accept) if (!values.has(accepted)) errors.push(`Question ${q.number}: answer "${accepted}" is not one of the options.`);
    } else {
      if (!q.prompt.includes("____")) errors.push(`Question ${q.number}: the prompt needs "____" where the answer goes.`);
      for (const accepted of key.accept) {
        if (countWords(accepted) > q.maxWords) errors.push(`Question ${q.number}: "${accepted}" is longer than ${q.maxWords} word(s).`);
      }
      if (!key.accept.some((accepted) => normalizedSource.includes(normalizeAnswer(accepted)))) {
        errors.push(`Question ${q.number}: none of the accepted answers (${key.accept.join(", ")}) appear word-for-word in the ${source ? "text" : "source"}.`);
      }
    }
  }
  const extra = Object.keys(answers).filter((key) => !ids.includes(key));
  if (extra.length) errors.push(`Answers for unknown questions: ${extra.join(", ")}.`);
}

export function validateContent(kind: ContentKind, slug: string, draft: ContentDraft): ValidationResult {
  const errors: string[] = [];
  const schema = { reading: readingSchema, listening: listeningSchema, writing: writingSchema, speaking: speakingSchema }[kind];
  const parsed = schema.safeParse(draft.payload);
  if (!parsed.success) return { errors: zodErrors("payload", parsed.error) };
  const payload = parsed.data as ReadingSet | ListeningSet | WritingTask | SpeakingSet;
  if (payload.id !== slug) errors.push(`payload.id must be "${slug}".`);

  if (kind === "reading" || kind === "listening") {
    const answers = answersSchema.safeParse(draft.answers ?? {});
    if (!answers.success) return { errors: [...errors, ...zodErrors("answers", answers.error)] };
    let source = "";
    if (kind === "reading") {
      source = (payload as ReadingSet).passage.paragraphs.map((p) => p.text).join(" ");
      const labels = (payload as ReadingSet).passage.paragraphs.map((p) => p.label);
      if (new Set(labels).size !== labels.length) errors.push("Paragraph labels must be unique.");
    } else {
      const script = scriptSchema.safeParse(draft.script);
      if (!script.success) return { errors: [...errors, ...zodErrors("script", script.error)] };
      const value = script.data as ListeningScript;
      for (const line of value.lines) if (!value.voices[line.speaker]) errors.push(`Script: speaker ${line.speaker} has no voice.`);
      source = value.lines.map((line) => line.text).join(" ");
    }
    checkQuestions((payload as ReadingSet).groups, answers.data, source, errors);
    for (const q of allQuestions((payload as ReadingSet).groups)) {
      if (!q.id.startsWith(`${slug}-`)) errors.push(`Question id "${q.id}" must start with "${slug}-".`);
    }
  }

  if (kind === "writing") {
    const task = payload as WritingTask;
    const expected = task.task === 1 ? { minutes: 20, minWords: 150 } : { minutes: 40, minWords: 250 };
    if (task.minutes !== expected.minutes || task.minWords !== expected.minWords) {
      errors.push(`Task ${task.task} must be ${expected.minutes} minutes and at least ${expected.minWords} words.`);
    }
    if (task.task === 1 && !task.visual) errors.push("Task 1 needs a chart or process diagram (visual).");
    if (task.task === 2 && task.visual) errors.push("Task 2 must not have a visual.");
    if (task.task === 2 && !task.question) errors.push("Task 2 needs a question.");
    if (task.visual?.kind === "line-chart") {
      for (const series of task.visual.series) {
        if (series.values.length !== task.visual.categories.length) errors.push(`Chart series "${series.name}" needs ${task.visual.categories.length} values.`);
      }
    }
  }

  return { errors };
}

/** Lowercase URL-safe slug from a title, e.g. "Coral Reefs" → "coral-reefs". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
