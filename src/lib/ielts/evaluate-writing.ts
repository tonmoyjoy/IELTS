import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

export const WRITING_PROMPT_VERSION = "writing-v1.0";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

const writingEvaluationSchema = z.object({
  bandScore: z.number().min(0).max(9),
  breakdown: z.object({
    taskAchievement: z.number().min(0).max(9),
    coherenceCohesion: z.number().min(0).max(9),
    lexicalResource: z.number().min(0).max(9),
    grammaticalRange: z.number().min(0).max(9),
  }),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  summary: z.string(),
});

export type WritingEvaluation = z.infer<typeof writingEvaluationSchema>;

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model returned invalid JSON");
  }
}

export function getWritingModelName() {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
}

export async function evaluateWriting(input: {
  taskLabel: string;
  prompt: string;
  answer: string;
  minWords: number;
}): Promise<WritingEvaluation> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is required for writing evaluation");

  const gen = new GoogleGenerativeAI(key);
  const model = gen.getGenerativeModel({
    model: getWritingModelName(),
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are an IELTS Writing examiner. Evaluate the candidate answer using official IELTS-style writing criteria.

Task: ${input.taskLabel}
Minimum words: ${input.minWords}
Question:
${input.prompt}

Candidate answer:
${input.answer}

Return one JSON object only with:
- bandScore: overall 0-9 score, halves allowed
- breakdown.taskAchievement
- breakdown.coherenceCohesion
- breakdown.lexicalResource
- breakdown.grammaticalRange
- strengths: 2-4 concise bullet strings
- improvements: 2-4 concise bullet strings
- summary: 2-4 sentences of direct feedback`;

  const res = await model.generateContent(prompt);
  return writingEvaluationSchema.parse(parseJsonObject(res.response.text()));
}
