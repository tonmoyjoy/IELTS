import { describe, expect, it } from "vitest";
import { convertDraft } from "@/server/ai/content-drafter";
import { slugify, validateContent } from "@/server/content/validate";
import type { ListeningSet, ReadingSet, WritingTask } from "@/content/types";

import { rawReading } from "../support/content-fixtures";

describe("AI content drafts", () => {
  it("converts a reading draft into numbered questions with answer keys", () => {
    const draft = convertDraft("reading", "bees-ab12", rawReading, { kind: "reading", topic: "bees" });
    const set = draft.payload as ReadingSet;
    expect(set.id).toBe("bees-ab12");
    expect(set.passage.paragraphs.map((p) => p.label)).toEqual(["A", "B", "C", "D"]);
    const questions = set.groups.flatMap((g) => g.questions);
    expect(questions.map((q) => q.id)).toEqual(["bees-ab12-1", "bees-ab12-2", "bees-ab12-3", "bees-ab12-4", "bees-ab12-5"]);
    expect(set.groups.map((g) => g.range)).toEqual(["Questions 1–2", "Question 3", "Question 4", "Question 5"]);
    expect(draft.answers).toMatchObject({
      "bees-ab12-2": { accept: ["FALSE"] },
      "bees-ab12-3": { accept: ["D"] },
      "bees-ab12-4": { accept: ["B"] },
      "bees-ab12-5": { accept: ["sun"] },
    });
    expect(draft.errors).toEqual([]);
  });

  it("flags answers that do not appear in the passage", () => {
    const broken = structuredClone(rawReading);
    broken.groups[3].questions[0].answer = "moon";
    const draft = convertDraft("reading", "bees-ab12", broken, { kind: "reading", topic: "bees" });
    expect(draft.errors.join(" ")).toMatch(/Question 5: none of the accepted answers \(moon\)/);
  });

  it("converts a listening draft with a script and the requested part", () => {
    const raw = {
      title: "Booking a tour",
      summary: "A caller books a tour.",
      intro: "Part one. You will hear a phone call.",
      speakers: [{ letter: "A", gender: "female" }, { letter: "B", gender: "male" }],
      lines: [
        { speaker: "A", text: "Hello, City Tours." },
        { speaker: "B", text: "I'd like to book the river tour on Friday." },
        { speaker: "A", text: "It leaves at ten." },
        { speaker: "B", text: "My name is Patel." },
        { speaker: "A", text: "How many people?" },
        { speaker: "B", text: "Two adults." },
        { speaker: "A", text: "That is forty pounds." },
        { speaker: "B", text: "Thank you." },
      ],
      groups: [{ type: "completion", instructions: "ONE WORD", maxWords: 1, questions: [{ prompt: "Day: ____", answer: "Friday", explanation: "B says Friday." }] }],
    };
    const draft = convertDraft("listening", "tour-1234", raw, { kind: "listening", topic: "tour", variant: 1 });
    expect((draft.payload as ListeningSet).section).toBe(1);
    expect(draft.script).toMatchObject({ voices: { A: "female", B: "male" }, intro: raw.intro });
    expect(draft.errors.some((e) => e.includes("5–40 questions"))).toBe(true);
  });

  it("builds Task 1 with its chart and enforces task timing", () => {
    const raw = {
      title: "Cinema visits",
      prompt: "The chart below shows cinema visits.",
      chart: { title: "Visits", xLabel: "Year", yLabel: "Millions", unit: "m", categories: ["2000", "2010", "2020"], series: [{ name: "A", values: [1, 2, 3] }, { name: "B", values: [3, 2, 1] }] },
    };
    const draft = convertDraft("writing", "cinema-1a2b", raw, { kind: "writing", topic: "cinema", variant: 1 });
    const task = draft.payload as WritingTask;
    expect(task).toMatchObject({ task: 1, minutes: 20, minWords: 150, visual: { kind: "line-chart" } });
    expect(draft.errors).toEqual([]);
    const wrong = validateContent("writing", "cinema-1a2b", { payload: { ...task, minutes: 30 } });
    expect(wrong.errors[0]).toMatch(/20 minutes/);
  });

  it("requires the payload id to match the slug and well-formed ids", () => {
    const draft = convertDraft("speaking", "food-9f9f", { title: "Food", part1: ["a?", "b?", "c?"], cue: "Describe a meal.", bullets: ["what", "where", "and explain why"], part3: ["x?", "y?", "z?"] }, { kind: "speaking", topic: "food" });
    expect(draft.errors).toEqual([]);
    expect(validateContent("speaking", "other-slug", draft).errors[0]).toMatch(/payload.id must be "other-slug"/);
  });

  it("slugifies titles", () => {
    expect(slugify("  The Coral Reefs: A Study! ")).toBe("the-coral-reefs-a-study");
  });
});
