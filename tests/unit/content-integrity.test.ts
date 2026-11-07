import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readingSets } from "@/content/reading";
import { listeningSets } from "@/content/listening";
import { writingTasks, describeVisual } from "@/content/writing";
import { speakingSets } from "@/content/speaking";
import { allQuestions } from "@/content/types";
import { answerKeys } from "@/server/content/answer-keys";
import { getListeningScript } from "@/server/content/listening-scripts";
import { gradeSet, normalizeAnswer } from "@/server/practice/grading";
import { countWords } from "@/lib/text";

const sets = [
  ...readingSets.map((set) => ({ module: "reading" as const, set })),
  ...listeningSets.map((set) => ({ module: "listening" as const, set })),
];

function sourceText(module: "reading" | "listening", id: string): string {
  if (module === "reading") {
    const set = readingSets.find((s) => s.id === id)!;
    return set.passage.paragraphs.map((p) => p.text).join(" ");
  }
  return getListeningScript(id)!.lines.map((line) => line.text).join(" ");
}

describe("practice content integrity", () => {
  it("has unique question ids across all sets", () => {
    const ids = sets.flatMap(({ set }) => allQuestions(set.groups).map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no orphaned answer keys", () => {
    const ids = new Set(sets.flatMap(({ set }) => allQuestions(set.groups).map((q) => q.id)));
    expect(Object.keys(answerKeys).filter((id) => !ids.has(id))).toEqual([]);
  });

  it.each(sets.map(({ module, set }) => [module, set.id, set] as const))("%s/%s is complete and consistent", (module, id, set) => {
    const questions = allQuestions(set.groups);
    expect(questions.length).toBeGreaterThanOrEqual(10);
    expect(questions.length).toBeLessThanOrEqual(13);
    expect(questions.map((q) => q.number)).toEqual(questions.map((_, index) => index + 1));

    const text = normalizeAnswer(sourceText(module, id));
    for (const question of questions) {
      const key = answerKeys[question.id];
      expect(key, `missing key for ${question.id}`).toBeDefined();
      expect(key.explanation.length).toBeGreaterThan(5);
      if (question.kind === "choice") {
        const values = question.options.map((option) => option.value);
        for (const accepted of key.accept) expect(values, question.id).toContain(accepted);
      } else {
        expect(question.prompt, question.id).toContain("____");
        for (const accepted of key.accept) {
          expect(countWords(accepted), `${question.id} '${accepted}' breaks the word limit`).toBeLessThanOrEqual(question.maxWords);
        }
        // At least one accepted form must literally occur in the passage or script.
        const found = key.accept.some((accepted) => text.includes(normalizeAnswer(accepted)));
        expect(found, `${question.id}: none of ${JSON.stringify(key.accept)} appear in the source`).toBe(true);
      }
    }
  });

  it.each(sets.map(({ module, set }) => [module, set.id, set] as const))("%s/%s scores 9 when every answer is correct", (module, _id, set) => {
    const answers = Object.fromEntries(allQuestions(set.groups).map((q) => [q.id, answerKeys[q.id].accept[0]]));
    const grade = gradeSet(module, set.groups, answers);
    expect(grade.rawScore).toBe(grade.totalQuestions);
    expect(grade.band).toBe(9);
  });

  it("ships an audio file and a script for every listening set", () => {
    for (const set of listeningSets) {
      expect(existsSync(path.join(process.cwd(), "public", set.audioSrc))).toBe(true);
      const script = getListeningScript(set.id);
      expect(script?.lines.length).toBeGreaterThan(3);
      for (const line of script!.lines) expect(script!.voices[line.speaker], `${set.id}: unknown speaker ${line.speaker}`).toBeDefined();
    }
  });

  it("listening audio files are valid MP3s", () => {
    for (const set of listeningSets) {
      const head = readFileSync(path.join(process.cwd(), "public", set.audioSrc)).subarray(0, 3);
      const isId3 = head.toString("latin1") === "ID3";
      const isFrameSync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
      expect(isId3 || isFrameSync).toBe(true);
    }
  });
});

describe("writing and speaking content", () => {
  it("writing tasks are well formed", () => {
    const ids = writingTasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const task of writingTasks) {
      expect(task.minWords).toBe(task.task === 1 ? 150 : 250);
      if (task.task === 1) expect(task.visual).toBeDefined();
      if (task.task === 2) expect(task.question).toBeTruthy();
    }
  });

  it("line-chart data is consistent and sums to 100% per year", () => {
    for (const task of writingTasks) {
      if (task.visual?.kind !== "line-chart") continue;
      const visual = task.visual;
      for (const series of visual.series) expect(series.values).toHaveLength(visual.categories.length);
      visual.categories.forEach((_, index) => {
        expect(visual.series.reduce((sum, s) => sum + s.values[index], 0)).toBe(100);
      });
      expect(describeVisual(task)).toContain("2025");
    }
  });

  it("speaking sets have all three parts", () => {
    for (const set of speakingSets) {
      expect(set.part1.length).toBeGreaterThanOrEqual(3);
      expect(set.part2.bullets.length).toBe(4);
      expect(set.part3.length).toBeGreaterThanOrEqual(3);
    }
  });
});
