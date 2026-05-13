import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const evaluationSchema = z.object({
  bandScore: z.number().min(0).max(9),
  breakdown: z.object({
    fluency: z.number().min(0).max(9),
    lexicalResource: z.number().min(0).max(9),
    grammaticalRange: z.number().min(0).max(9),
    pronunciation: z.number().min(0).max(9),
  }),
  summary: z.string().optional(),
});

export type IeltsEvaluation = z.infer<typeof evaluationSchema>;

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const SPEAKING_PROMPT_VERSION = "speaking-v2.0";

export function getAiProvider() {
  return process.env.AI_EVAL_PROVIDER ?? "gemini";
}

export function getEvaluationModelName() {
  return getAiProvider() === "gemini"
    ? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
    : process.env.OPENAI_EVAL_MODEL ?? "gpt-4o-mini";
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model returned invalid JSON");
  }
}

const SYSTEM_PROMPT = `You are an IELTS speaking examiner. You receive ONLY the transcript of a candidate's spoken English (no audio). Evaluate fairly using IELTS Speaking criteria:

1) Fluency and Coherence — flow, hesitation, linking
2) Lexical Resource — range, precision, paraphrasing
3) Grammatical Range and Accuracy — structures and errors
4) Pronunciation — ESTIMATE from spelling/phonetic cues in text only; you cannot hear audio, so score conservatively and note this is approximate.

Respond with a single JSON object (no markdown) with keys:
- "bandScore": overall band (0–9, halves allowed e.g. 6.5)
- "breakdown": object with "fluency", "lexicalResource", "grammaticalRange", "pronunciation" (each 0–9, halves allowed)
- "summary": brief examiner-style feedback (2–4 sentences)`;

export async function evaluateTranscript(transcript: string): Promise<IeltsEvaluation> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY is required when AI_EVAL_PROVIDER=gemini");
    const gen = new GoogleGenerativeAI(key);
    const model = gen.getGenerativeModel({
      model: getEvaluationModelName(),
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const prompt = `${SYSTEM_PROMPT}\n\nTranscript:\n${transcript}`;
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    return evaluationSchema.parse(parseJsonObject(text));
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for evaluation (or set GEMINI + AI_EVAL_PROVIDER=gemini)");

  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model: getEvaluationModelName(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty evaluation response");
  return evaluationSchema.parse(parseJsonObject(raw));
}

/**
 * Streams model tokens to `onDelta` while accumulating JSON, then parses the full evaluation.
 * OpenAI uses chat streaming with json_object; Gemini uses generateContentStream.
 */
export async function evaluateTranscriptStreaming(
  transcript: string,
  onDelta: (chunk: string) => void
): Promise<IeltsEvaluation> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) throw new Error("GEMINI_API_KEY is required when AI_EVAL_PROVIDER=gemini");
    const gen = new GoogleGenerativeAI(key);
    const model = gen.getGenerativeModel({
      model: getEvaluationModelName(),
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    const prompt = `${SYSTEM_PROMPT}\n\nTranscript:\n${transcript}`;
    const streamResult = await model.generateContentStream(prompt);
    let full = "";
    for await (const chunk of streamResult.stream) {
      const part = chunk.text();
      if (part) {
        full += part;
        onDelta(part);
      }
    }
    return evaluationSchema.parse(parseJsonObject(full));
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for evaluation (or set GEMINI + AI_EVAL_PROVIDER=gemini)");

  const openai = new OpenAI({ apiKey: key });
  const stream = await openai.chat.completions.create({
    model: getEvaluationModelName(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.3,
    stream: true,
  });

  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }

  if (!full.trim()) throw new Error("Empty streaming evaluation response");
  return evaluationSchema.parse(parseJsonObject(full));
}
