import { describe, expect, it } from "vitest";
import { gradeQuestion, gradeSet, normalizeAnswer } from "@/server/practice/grading";
import type { ChoiceQuestion, TextQuestion } from "@/content/types";
import { getReadingSet } from "@/content/reading";
import { TFNG_OPTIONS } from "@/content/options";

const text = (maxWords: number): TextQuestion => ({ id: "q", number: 1, kind: "text", prompt: "x ____", maxWords, allowNumber: true });
const choice: ChoiceQuestion = { id: "c", number: 2, kind: "choice", prompt: "y", options: TFNG_OPTIONS };
const key = (accept: string[]) => ({ display: accept[0], accept, explanation: "because" });

describe("normalizeAnswer", () => {
  it("normalises case, punctuation, quotes, hyphens and currency", () => {
    expect(normalizeAnswer("  Satellite   Data. ")).toBe("satellite data");
    expect(normalizeAnswer("two–hour")).toBe("two hour");
    expect(normalizeAnswer("£85")).toBe("85");
    expect(normalizeAnswer("“asthma”")).toBe("asthma");
    expect(normalizeAnswer("6.30")).toBe("6.30");
  });
});

describe("gradeQuestion", () => {
  it("accepts listed variants and is case-insensitive", () => {
    expect(gradeQuestion(text(1), "TWELFTH", key(["12th", "twelfth"])).correct).toBe(true);
    expect(gradeQuestion(text(1), "13th", key(["12th", "twelfth"])).correct).toBe(false);
  });

  it("does not forgive spelling mistakes", () => {
    expect(gradeQuestion(text(1), "asthmaa", key(["asthma"])).correct).toBe(false);
  });

  it("marks answers over the word limit wrong and says why", () => {
    const result = gradeQuestion(text(1), "rain gardens", key(["gardens"]));
    expect(result.correct).toBe(false);
    expect(result.overWordLimit).toBe(true);
  });

  it("treats empty answers as wrong without crashing", () => {
    expect(gradeQuestion(text(1), "   ", key(["a"])).correct).toBe(false);
  });

  it("only accepts real options for choice questions", () => {
    expect(gradeQuestion(choice, "not given", key(["NOT GIVEN"])).correct).toBe(true);
    expect(gradeQuestion(choice, "NG", key(["NOT GIVEN"])).correct).toBe(false);
    expect(gradeQuestion(choice, "TRUE", key(["FALSE"])).correct).toBe(false);
  });

  it("caps the stored answer length", () => {
    expect(gradeQuestion(text(1), "x".repeat(500), key(["a"])).given).toHaveLength(200);
  });
});

describe("gradeSet", () => {
  const set = getReadingSet("urban-green-spaces")!;

  it("scores an empty submission as zero", () => {
    const grade = gradeSet("reading", set.groups, {});
    expect(grade.rawScore).toBe(0);
    expect(grade.band).toBe(0);
    expect(grade.results).toHaveLength(12);
  });

  it("ignores answers for unknown question ids and non-string values", () => {
    const grade = gradeSet("reading", set.groups, { "ugs-1": "TRUE", evil: "x", "ugs-2": 42 as unknown as string });
    expect(grade.rawScore).toBe(1);
  });
});
