import "server-only";
import { z } from "zod";
import { getGenAI } from "@/server/ai/client";
import { parseJsonObject } from "@/server/ai/json";
import { UNTRUSTED_INPUT_RULE } from "@/server/ai/untrusted";
import { getEvaluationModel } from "@/server/env";
import type { SpeakingSet } from "@/content/types";
import { overallFromCriteria, roundToHalfBand } from "@/lib/bands";

export const SPEAKING_PROMPT_VERSION = "speaking-v3.1";

const band = z.number().min(0).max(9);

const modelOutputSchema = z.object({
  transcript: z.string().max(20_000),
  speechDetected: z.boolean(),
  criteria: z.object({
    fluencyCoherence: band,
    lexicalResource: band,
    grammaticalRange: band,
    pronunciation: band,
  }),
  summary: z.string().max(1500),
  strengths: z.array(z.string().max(300)).max(5),
  improvements: z.array(z.string().max(300)).max(5),
});

export type SpeakingCriteria = z.infer<typeof modelOutputSchema>["criteria"];

export type SpeakingEvaluation = {
  bandScore: number;
  criteria: SpeakingCriteria;
  transcript: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

const responseJsonSchema = {
  type: "object",
  properties: {
    transcript: { type: "string" },
    speechDetected: { type: "boolean" },
    criteria: {
      type: "object",
      properties: {
        fluencyCoherence: { type: "number", minimum: 0, maximum: 9 },
        lexicalResource: { type: "number", minimum: 0, maximum: 9 },
        grammaticalRange: { type: "number", minimum: 0, maximum: 9 },
        pronunciation: { type: "number", minimum: 0, maximum: 9 },
      },
      required: ["fluencyCoherence", "lexicalResource", "grammaticalRange", "pronunciation"],
    },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
  },
  required: ["transcript", "speechDetected", "criteria", "summary", "strengths", "improvements"],
};

export class NoSpeechError extends Error {
  constructor() {
    super("No speech detected");
    this.name = "NoSpeechError";
  }
}

export function buildSpeakingSystemInstruction(): string {
  return [
    "You are a strict, experienced IELTS Speaking examiner. You will receive an audio recording of a candidate answering IELTS Speaking questions.",
    "First, transcribe exactly what the candidate says in plain text (no timestamps, labels or commentary), keeping hesitations such as 'um' and 'er'.",
    "If the recording contains no intelligible English speech, set speechDetected to false and give every criterion 0.",
    "Then assess the candidate against the four official criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. " +
      "Use the audio itself to judge pronunciation, intonation, stress and fluency. Give each criterion a band from 0 to 9 in whole or half bands using the public IELTS band descriptors. Do not inflate scores.",
    "Judge relevance against the questions the candidate was asked. Very short, memorised or off-topic answers must be penalised in Fluency and Coherence.",
    UNTRUSTED_INPUT_RULE,
    "Write the summary (2–4 sentences), strengths (2–4 items) and improvements (2–4 items) directly to the candidate, quoting short phrases from what they said where useful.",
    "Respond only with JSON matching the provided schema.",
  ].join("\n\n");
}

export function buildSpeakingContext(set: SpeakingSet | undefined, durationSeconds: number, fullTest = false): string {
  const questions = set
    ? [
        `Part 1 questions: ${set.part1.join(" | ")}`,
        `Part 2 cue card: ${set.part2.cue} You should say: ${set.part2.bullets.join("; ")}.`,
        `Part 3 questions: ${set.part3.join(" | ")}`,
      ].join("\n")
    : "The candidate chose their own speaking topic.";
  const scope = fullTest
    ? "This is a complete Speaking test. The recording contains the candidate's answers to Part 1, the Part 2 long turn and Part 3, in that order. The examiner's voice may be faintly audible: assess only the candidate.\nThe candidate was asked these questions:"
    : "The candidate may answer any of these questions:";
  return `<exam_context>\nRecording length: ${Math.round(durationSeconds)} seconds.\n${scope}\n${questions}\n</exam_context>\n\nThe attached audio is the candidate's spoken response.`;
}

export function finaliseSpeakingEvaluation(raw: z.infer<typeof modelOutputSchema>): SpeakingEvaluation {
  if (!raw.speechDetected || raw.transcript.trim().split(/\s+/).filter(Boolean).length < 5) {
    throw new NoSpeechError();
  }
  const criteria: SpeakingCriteria = {
    fluencyCoherence: roundToHalfBand(raw.criteria.fluencyCoherence),
    lexicalResource: roundToHalfBand(raw.criteria.lexicalResource),
    grammaticalRange: roundToHalfBand(raw.criteria.grammaticalRange),
    pronunciation: roundToHalfBand(raw.criteria.pronunciation),
  };
  return {
    bandScore: overallFromCriteria(Object.values(criteria)),
    criteria,
    transcript: raw.transcript.trim(),
    summary: raw.summary.trim(),
    strengths: raw.strengths.map((item) => item.trim()).filter(Boolean),
    improvements: raw.improvements.map((item) => item.trim()).filter(Boolean),
  };
}

export function parseSpeakingModelOutput(text: string) {
  return modelOutputSchema.parse(parseJsonObject(text));
}

/**
 * One multimodal call: the model hears the audio, so pronunciation is judged
 * from speech rather than guessed from a transcript.
 */
export async function evaluateSpeaking(input: {
  audio: Buffer;
  mimeType: string;
  durationSeconds: number;
  set: SpeakingSet | undefined;
  fullTest?: boolean;
}): Promise<SpeakingEvaluation> {
  const ai = getGenAI();
  const request = {
    model: getEvaluationModel(),
    contents: [
      {
        role: "user",
        parts: [
          { text: buildSpeakingContext(input.set, input.durationSeconds, input.fullTest) },
          { inlineData: { mimeType: input.mimeType, data: input.audio.toString("base64") } },
        ],
      },
    ],
    config: {
      systemInstruction: buildSpeakingSystemInstruction(),
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
      return finaliseSpeakingEvaluation(parseSpeakingModelOutput(response.text ?? ""));
    } catch (error) {
      if (error instanceof NoSpeechError) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
