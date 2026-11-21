import "server-only";
import { z } from "zod";
import { getGenAI } from "@/server/ai/client";
import { parseJsonObject } from "@/server/ai/json";
import { getContentModel } from "@/server/env";
import { letterOptions, paragraphOptions, TFNG_OPTIONS, YNNG_OPTIONS } from "@/content/options";
import type { ChoiceOption, ListeningSet, Question, QuestionGroup, ReadingSet, SpeakingSet, WritingTask } from "@/content/types";
import type { AnswerKey } from "@/server/content/answer-keys";
import type { ListeningScript } from "@/server/content/listening-scripts";
import type { ContentKind } from "@/server/models/ContentItem";
import { validateContent, type ContentDraft } from "@/server/content/validate";

/**
 * Drafts new practice content with Gemini for the admin content editor.
 * The model writes a simple intermediate format; this module converts it into
 * the app's content types, numbers the questions and validates the result.
 * Drafts are never published automatically: an admin reviews and publishes.
 */

export type DraftRequest = {
  kind: ContentKind;
  topic: string;
  notes?: string;
  /** Listening section (1–4) or writing task (1–2). */
  variant?: number;
};

export type Drafted = ContentDraft & { title: string; errors: string[] };

const QUESTION_TYPES = ["tfng", "ynng", "matching", "mcq", "completion"] as const;

const genQuestion = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
  explanation: z.string().min(1),
});
const genGroup = z.object({
  type: z.enum(QUESTION_TYPES),
  instructions: z.string().min(1),
  maxWords: z.number().int().min(1).max(3).optional(),
  allowNumber: z.boolean().optional(),
  questions: z.array(genQuestion).min(1),
});

const genReading = z.object({
  title: z.string(),
  summary: z.string(),
  heading: z.string(),
  paragraphs: z.array(z.string()).min(4).max(9),
  groups: z.array(genGroup).min(2).max(4),
});
const genListening = z.object({
  title: z.string(),
  summary: z.string(),
  intro: z.string(),
  speakers: z.array(z.object({ letter: z.string().regex(/^[A-Z]$/), gender: z.enum(["male", "female"]) })).min(1).max(3),
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })).min(8),
  groups: z.array(genGroup).min(1).max(3),
});
const genWriting = z.object({
  title: z.string(),
  prompt: z.string(),
  question: z.string().optional(),
  chart: z
    .object({
      title: z.string(),
      xLabel: z.string(),
      yLabel: z.string(),
      unit: z.string(),
      categories: z.array(z.string()),
      series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
    })
    .optional(),
});
const genSpeaking = z.object({
  title: z.string(),
  part1: z.array(z.string()).min(3),
  cue: z.string(),
  bullets: z.array(z.string()).min(3),
  part3: z.array(z.string()).min(3),
});

const groupJsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: [...QUESTION_TYPES] },
    instructions: { type: "string" },
    maxWords: { type: "integer" },
    allowNumber: { type: "boolean" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          alternatives: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
        required: ["prompt", "answer", "explanation"],
      },
    },
  },
  required: ["type", "instructions", "questions"],
};

const JSON_SCHEMAS: Record<ContentKind, object> = {
  reading: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      heading: { type: "string" },
      paragraphs: { type: "array", items: { type: "string" } },
      groups: { type: "array", items: groupJsonSchema },
    },
    required: ["title", "summary", "heading", "paragraphs", "groups"],
  },
  listening: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      intro: { type: "string" },
      speakers: {
        type: "array",
        items: { type: "object", properties: { letter: { type: "string" }, gender: { type: "string", enum: ["male", "female"] } }, required: ["letter", "gender"] },
      },
      lines: { type: "array", items: { type: "object", properties: { speaker: { type: "string" }, text: { type: "string" } }, required: ["speaker", "text"] } },
      groups: { type: "array", items: groupJsonSchema },
    },
    required: ["title", "summary", "intro", "speakers", "lines", "groups"],
  },
  writing: {
    type: "object",
    properties: {
      title: { type: "string" },
      prompt: { type: "string" },
      question: { type: "string" },
      chart: {
        type: "object",
        properties: {
          title: { type: "string" },
          xLabel: { type: "string" },
          yLabel: { type: "string" },
          unit: { type: "string" },
          categories: { type: "array", items: { type: "string" } },
          series: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, values: { type: "array", items: { type: "number" } } }, required: ["name", "values"] },
          },
        },
        required: ["title", "xLabel", "yLabel", "unit", "categories", "series"],
      },
    },
    required: ["title", "prompt"],
  },
  speaking: {
    type: "object",
    properties: {
      title: { type: "string" },
      part1: { type: "array", items: { type: "string" } },
      cue: { type: "string" },
      bullets: { type: "array", items: { type: "string" } },
      part3: { type: "array", items: { type: "string" } },
    },
    required: ["title", "part1", "cue", "bullets", "part3"],
  },
};

const RULES_OBJECTIVE = [
  "Question group types: tfng (TRUE/FALSE/NOT GIVEN; answer is exactly TRUE, FALSE or NOT GIVEN), ynng (writer's views; YES/NO/NOT GIVEN), matching (which paragraph contains the information; answer is a paragraph letter A, B, C…), mcq (give 3–4 options; answer is the letter A–D of the correct option), completion (prompt contains ____ where the answer goes; set maxWords 1–3 and allowNumber; the answer must be copied word-for-word from the text and fit the word limit).",
  "Every answer must be clearly supported or contradicted by the text; NOT GIVEN answers must be genuinely absent. Explanations quote or point to the exact place in the text.",
  "Use original material: do not copy published IELTS tests or real copyrighted articles.",
];

export function buildDraftInstruction(request: DraftRequest): string {
  const notes = request.notes?.trim() ? `\nExtra instructions from the editor: ${request.notes.trim()}` : "";
  switch (request.kind) {
    case "reading":
      return [
        `Write an original IELTS Academic Reading passage about: ${request.topic}.`,
        "700–900 words in 5–7 paragraphs, academic but accessible, similar in difficulty to a real IELTS passage. Do not include paragraph letters in the text.",
        "Then write 12–13 questions in 3 groups using at least three different group types.",
        ...RULES_OBJECTIVE,
        notes,
      ].join("\n");
    case "listening": {
      const section = request.variant ?? 1;
      const style =
        section === 1
          ? "a telephone or face-to-face conversation between two people in an everyday social context (e.g. booking, enquiry); include names spelled letter by letter, numbers, dates and prices"
          : section === 2
            ? "a monologue by one speaker in an everyday social context (e.g. a guide or announcement)"
            : section === 3
              ? "a conversation between two or three people in an educational context (e.g. students and a tutor discussing an assignment)"
              : "an academic lecture by one speaker";
      return [
        `Write an original IELTS Listening Part ${section} recording script about: ${request.topic}. It should be ${style}.`,
        "About 600–800 words of natural spoken English with hesitations kept light. Speakers are single capital letters (e.g. A, B) with a gender.",
        "intro: what the narrator says before the recording, e.g. 'Part one. You will hear … First, you have some time to look at questions one to six.'",
        "Then write 10 questions in 2 groups (completion and mcq), in the order the answers are heard.",
        ...RULES_OBJECTIVE.map((rule) => rule.replace("from the text", "from what a speaker says")),
        notes,
      ].join("\n");
    }
    case "writing":
      return request.variant === 1
        ? [
            `Write an original IELTS Academic Writing Task 1 question about: ${request.topic}.`,
            "Provide a line chart (chart) with 2–4 series and 4–8 categories (usually years) and realistic numbers with clear trends.",
            "prompt: the usual instructions, e.g. 'The chart below shows … Summarise the information by selecting and reporting the main features, and make comparisons where relevant.'",
            notes,
          ].join("\n")
        : [
            `Write an original IELTS Academic Writing Task 2 question about: ${request.topic}.`,
            "prompt: one or two sentences presenting the issue. question: the task, e.g. 'To what extent do you agree or disagree?' or 'Discuss both views and give your own opinion.'",
            "Do not include a chart.",
            notes,
          ].join("\n");
    case "speaking":
      return [
        `Write an original IELTS Speaking test about: ${request.topic}.`,
        "part1: 4 short, personal questions on a familiar related topic. cue: a Part 2 cue card starting 'Describe …'. bullets: the four 'You should say' points, the last starting 'and explain'. part3: 4 more abstract discussion questions linked to the Part 2 topic.",
        notes,
      ].join("\n");
  }
}

const LETTER = (index: number) => String.fromCharCode(65 + index);

function convertGroups(slug: string, groups: z.infer<typeof genGroup>[], paragraphCount: number): { groups: QuestionGroup[]; answers: Record<string, AnswerKey> } {
  const answers: Record<string, AnswerKey> = {};
  let number = 0;
  const converted = groups.map((group) => {
    const first = number + 1;
    const questions: Question[] = group.questions.map((q) => {
      number += 1;
      const qid = `${slug}-${number}`;
      const accept = [q.answer, ...(q.alternatives ?? [])].map((a) => a.trim()).filter(Boolean);
      if (group.type === "completion") {
        answers[qid] = { display: q.answer.trim(), accept, explanation: q.explanation };
        return { id: qid, number, kind: "text", prompt: q.prompt.includes("____") ? q.prompt : `${q.prompt} ____`, maxWords: group.maxWords ?? 2, allowNumber: group.allowNumber ?? true };
      }
      let options: ChoiceOption[];
      let answer = q.answer.trim().toUpperCase();
      if (group.type === "tfng") options = TFNG_OPTIONS;
      else if (group.type === "ynng") options = YNNG_OPTIONS;
      else if (group.type === "matching") {
        options = paragraphOptions(paragraphCount);
        answer = answer.replace(/^PARAGRAPH\s+/, "");
      } else {
        options = letterOptions((q.options ?? []).map((o) => o.replace(/^[A-D][).:]\s*/, "")));
        if (!/^[A-Z]$/.test(answer)) {
          const index = (q.options ?? []).findIndex((o) => o.trim().toUpperCase() === answer);
          if (index >= 0) answer = LETTER(index);
        }
      }
      const display = options.find((o) => o.value === answer)?.label ?? answer;
      answers[qid] = { display, accept: [answer], explanation: q.explanation };
      return { id: qid, number, kind: "choice", prompt: q.prompt, options };
    });
    return { range: first === number ? `Question ${first}` : `Questions ${first}–${number}`, instructions: group.instructions, questions };
  });
  return { groups: converted, answers };
}

/** Converts the model's intermediate format into app content. Exported for tests. */
export function convertDraft(kind: ContentKind, slug: string, raw: unknown, request: DraftRequest): Drafted {
  if (kind === "reading") {
    const data = genReading.parse(raw);
    const { groups, answers } = convertGroups(slug, data.groups, data.paragraphs.length);
    const payload: ReadingSet = {
      id: slug,
      title: data.title,
      summary: data.summary,
      recommendedMinutes: 20,
      passage: { heading: data.heading, paragraphs: data.paragraphs.map((p, i) => ({ label: LETTER(i), text: p.trim() })) },
      groups,
    };
    return finish(kind, slug, { payload, answers, title: data.title });
  }
  if (kind === "listening") {
    const data = genListening.parse(raw);
    const { groups, answers } = convertGroups(slug, data.groups, 0);
    const script: ListeningScript = {
      intro: data.intro,
      voices: Object.fromEntries(data.speakers.map((s) => [s.letter, s.gender])),
      lines: data.lines.map((l) => ({ speaker: l.speaker.trim().toUpperCase().slice(0, 1), text: l.text.trim() })),
    };
    const section = (request.variant ?? 1) as ListeningSet["section"];
    const payload: ListeningSet = { id: slug, title: data.title, summary: data.summary, section, audioSrc: "", groups };
    return finish(kind, slug, { payload, answers, script, title: data.title });
  }
  if (kind === "writing") {
    const data = genWriting.parse(raw);
    const task = request.variant === 1 ? 1 : 2;
    const payload: WritingTask = {
      id: slug,
      task,
      title: data.title,
      minutes: task === 1 ? 20 : 40,
      minWords: task === 1 ? 150 : 250,
      prompt: data.prompt,
      ...(task === 2 && data.question ? { question: data.question } : {}),
      ...(task === 1 && data.chart ? { visual: { kind: "line-chart" as const, ...data.chart } } : {}),
    };
    return finish(kind, slug, { payload, title: data.title });
  }
  const data = genSpeaking.parse(raw);
  const payload: SpeakingSet = { id: slug, title: data.title, part1: data.part1, part2: { cue: data.cue, bullets: data.bullets }, part3: data.part3 };
  return finish(kind, slug, { payload, title: data.title });
}

function finish(kind: ContentKind, slug: string, draft: ContentDraft & { title: string }): Drafted {
  return { ...draft, errors: validateContent(kind, slug, draft).errors };
}

/**
 * Asks Gemini for a draft. If the first draft fails validation (for example
 * an answer that does not appear in the passage), the model gets one retry
 * with the problems listed. The draft is returned even if problems remain,
 * so the editor can fix them by hand.
 */
export async function draftContent(slug: string, request: DraftRequest): Promise<Drafted> {
  const ai = getGenAI();
  const system =
    "You write original, high-quality IELTS practice material for a test-preparation website. Follow the format exactly and respond only with JSON matching the schema.";
  let prompt = buildDraftInstruction(request);
  let last: Drafted | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await ai.models.generateContent({
      model: getContentModel(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: JSON_SCHEMAS[request.kind], temperature: 0.8 },
    });
    try {
      last = convertDraft(request.kind, slug, parseJsonObject(response.text ?? ""), request);
    } catch (error) {
      last = { payload: null, title: request.topic.slice(0, 80), errors: [`The AI returned an unusable draft (${error instanceof Error ? error.message.slice(0, 200) : "invalid"}).`] };
    }
    if (last.errors.length === 0) return last;
    prompt = `${buildDraftInstruction(request)}\n\nA previous attempt had these problems; avoid them:\n- ${last.errors.slice(0, 10).join("\n- ")}`;
  }
  return last!;
}
