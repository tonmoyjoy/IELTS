import "server-only";
import { z } from "zod";
import { getGenAI } from "@/server/ai/client";
import { parseJsonObject } from "@/server/ai/json";
import { UNTRUSTED_INPUT_RULE, wrapUntrusted } from "@/server/ai/untrusted";
import { getEvaluationModel } from "@/server/env";
import { describeVisual } from "@/content/writing";
import type { WritingTask } from "@/content/types";
import { overallFromCriteria, roundToHalfBand } from "@/lib/bands";
import { countWords } from "@/lib/text";

export const WRITING_PROMPT_VERSION = "writing-v3.0";

const band = z.number().min(0).max(9);

const modelOutputSchema = z.object({
  criteria: z.object({
    taskResponse: band,
    coherenceCohesion: band,
    lexicalResource: band,
    grammaticalRange: band,
  }),
  summary: z.string().min(1).max(1500),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
});

export type WritingCriteria = z.infer<typeof modelOutputSchema>["criteria"];

export type WritingEvaluation = {
  bandScore: number;
  criteria: WritingCriteria;
  summary: string;
  strengths: string[];
  improvements: string[];
  wordCount: number;
  underLength: boolean;
};

const responseJsonSchema = {
  type: "object",
  properties: {
    criteria: {
      type: "object",
      properties: {
        taskResponse: { type: "number", minimum: 0, maximum: 9 },
        coherenceCohesion: { type: "number", minimum: 0, maximum: 9 },
        lexicalResource: { type: "number", minimum: 0, maximum: 9 },
        grammaticalRange: { type: "number", minimum: 0, maximum: 9 },
      },
      required: ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRange"],
    },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
  },
  required: ["criteria", "summary", "strengths", "improvements"],
};

export function buildWritingSystemInstruction(task: WritingTask): string {
  const criterionOne = task.task === 1 ? "Task Achievement" : "Task Response";
  return [
    "You are a strict, experienced IELTS Academic Writing examiner.",
    `Assess the candidate's Writing Task ${task.task} response against the four official criteria: ` +
      `${criterionOne}, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.`,
    "Give each criterion a band from 0 to 9 in whole or half bands, using the public IELTS band descriptors. " +
      "Do not inflate scores: most candidates score between 5 and 7.",
    `Report the ${criterionOne} score in the "taskResponse" field.`,
    task.task === 1
      ? "For Task 1, check the candidate's figures and trends against the data provided. An overview of the main features is required for band 6 and above in Task Achievement. Opinions or reasons not shown in the data should be penalised."
      : "For Task 2, the candidate must answer every part of the question with a clear, consistently developed position.",
    `Responses under ${task.minWords} words must be penalised in ${criterionOne}. Memorised or off-topic text must be penalised heavily.`,
    UNTRUSTED_INPUT_RULE,
    "Write the summary (2–4 sentences), strengths (2–4 items) and improvements (2–4 items) directly to the candidate in plain English. " +
      "Improvements must be specific and actionable, quoting short phrases from the essay where useful.",
    "Respond only with JSON matching the provided schema.",
  ].join("\n\n");
}

export function buildWritingUserContent(task: WritingTask, answer: string, wordCount: number): string {
  const parts = [
    `<task>\nWriting Task ${task.task}. Minimum ${task.minWords} words. Recommended time ${task.minutes} minutes.\n${task.prompt}${
      task.question ? `\n${task.question}` : ""
    }\n</task>`,
  ];
  const visual = describeVisual(task);
  if (visual) parts.push(`<task_data>\n${visual}\n</task_data>`);
  parts.push(`<word_count>${wordCount}</word_count>`);
  parts.push(wrapUntrusted("candidate_essay", answer));
  return parts.join("\n\n");
}

/** Clamps criteria to half bands and derives the overall band on the server. */
export function finaliseWritingEvaluation(
  raw: z.infer<typeof modelOutputSchema>,
  wordCount: number,
  minWords: number
): WritingEvaluation {
  const criteria: WritingCriteria = {
    taskResponse: roundToHalfBand(raw.criteria.taskResponse),
    coherenceCohesion: roundToHalfBand(raw.criteria.coherenceCohesion),
    lexicalResource: roundToHalfBand(raw.criteria.lexicalResource),
    grammaticalRange: roundToHalfBand(raw.criteria.grammaticalRange),
  };
  return {
    bandScore: overallFromCriteria(Object.values(criteria)),
    criteria,
    summary: raw.summary.trim(),
    strengths: raw.strengths.map((item) => item.trim()).filter(Boolean),
    improvements: raw.improvements.map((item) => item.trim()).filter(Boolean),
    wordCount,
    underLength: wordCount < minWords,
  };
}

export function parseWritingModelOutput(text: string) {
  return modelOutputSchema.parse(parseJsonObject(text));
}

export async function evaluateWriting(task: WritingTask, answer: string): Promise<WritingEvaluation> {
  const ai = getGenAI();
  const wordCount = countWords(answer);
  const request = {
    model: getEvaluationModel(),
    contents: buildWritingUserContent(task, answer, wordCount),
    config: {
      systemInstruction: buildWritingSystemInstruction(task),
      responseMimeType: "application/json",
      responseJsonSchema,
      temperature: 0.2,
      seed: 7,
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await ai.models.generateContent(request);
    try {
      return finaliseWritingEvaluation(parseWritingModelOutput(response.text ?? ""), wordCount, task.minWords);
    } catch (error) {
      lastError = error; // malformed output: retry once
    }
  }
  throw lastError;
}
