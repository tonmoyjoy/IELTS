import "server-only";
import { allQuestions, type Question, type QuestionGroup } from "@/content/types";
import { answerKeys, type AnswerKey } from "@/server/content/answer-keys";
import { rawToBand } from "@/lib/bands";
import { countWords } from "@/lib/text";

export type QuestionResult = {
  id: string;
  number: number;
  given: string;
  correct: boolean;
  expected: string;
  explanation: string;
  /** Set when the answer was marked wrong only because it broke the word limit. */
  overWordLimit?: boolean;
};

export type GradeResult = {
  rawScore: number;
  totalQuestions: number;
  band: number;
  results: QuestionResult[];
};

/**
 * Normalises a free-text answer for comparison: case, surrounding
 * punctuation, curly quotes, hyphen/space variants and repeated whitespace.
 * Spelling is NOT forgiven, matching IELTS marking.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/£/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?'"()[\]]+|[\s.,;:!?'"()[\]]+$/g, "");
}

function isOverLimit(question: Question, given: string): boolean {
  if (question.kind !== "text") return false;
  return countWords(given) > question.maxWords;
}

export function gradeQuestion(question: Question, given: string, key: AnswerKey): QuestionResult {
  const trimmed = given.trim().slice(0, 200);
  const base = {
    id: question.id,
    number: question.number,
    given: trimmed,
    expected: key.display,
    explanation: key.explanation,
  };

  if (!trimmed) return { ...base, correct: false };

  if (question.kind === "choice") {
    const allowed = new Set(question.options.map((option) => option.value.toUpperCase()));
    const value = trimmed.toUpperCase();
    const correct = allowed.has(value) && key.accept.some((accepted) => accepted.toUpperCase() === value);
    return { ...base, correct };
  }

  if (isOverLimit(question, trimmed)) {
    return { ...base, correct: false, overWordLimit: true };
  }

  const normalized = normalizeAnswer(trimmed);
  const correct = key.accept.some((accepted) => normalizeAnswer(accepted) === normalized);
  return { ...base, correct };
}

export function gradeSet(
  module: "reading" | "listening",
  groups: QuestionGroup[],
  answers: Record<string, string>,
  keys: Record<string, AnswerKey> = answerKeys
): GradeResult {
  const questions = allQuestions(groups);
  const results = questions.map((question) => {
    const key = keys[question.id];
    if (!key) throw new Error(`Missing answer key for question ${question.id}`);
    const given = typeof answers[question.id] === "string" ? answers[question.id] : "";
    return gradeQuestion(question, given, key);
  });
  const rawScore = results.filter((result) => result.correct).length;
  return {
    rawScore,
    totalQuestions: questions.length,
    band: rawToBand(module, rawScore, questions.length),
    results,
  };
}
