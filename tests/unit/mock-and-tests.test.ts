import { describe, expect, it } from "vitest";
import { nextSection, overallBand, writingBand } from "@/lib/mock";
import { FULL_TEST_ID, listeningParts, readingParts, resolveListeningSets, resolveReadingSets } from "@/content/tests";
import { allQuestions } from "@/content/types";
import { buildSteps } from "@/components/cbt/SpeakingExam";
import { cueCardScript, EXAMINER_LINES, examinerAudioSrc, speakingSets } from "@/content/speaking";
import { buildSpeakingContext } from "@/server/ai/speaking";

describe("mock test scoring", () => {
  it("weights Task 2 double and rounds to half bands", () => {
    expect(writingBand(6, 7)).toBe(6.5); // 6.67
    expect(writingBand(5, 5)).toBe(5);
    expect(writingBand(0, 7)).toBe(4.5); // 4.67
  });

  it("averages the four sections with IELTS rounding", () => {
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25 → 6.5
    expect(overallBand([6, 6, 6, 7.5])).toBe(6.5); // 6.375 → 6.5
    expect(overallBand([7, 7, 7, 7.5])).toBe(7); // 7.125 → 7
    expect(overallBand([6, 7, 7, 7])).toBe(7); // 6.75 → 7
  });

  it("follows the real section order", () => {
    expect(nextSection("listening")).toBe("reading");
    expect(nextSection("reading")).toBe("writing");
    expect(nextSection("writing")).toBe("speaking");
    expect(nextSection("speaking")).toBe("done");
  });
});

describe("computer-delivered test parts", () => {
  it("numbers questions continuously across passages", () => {
    const sets = resolveReadingSets(FULL_TEST_ID)!;
    const parts = readingParts(sets);
    expect(parts.map((p) => p.label)).toEqual(sets.map((_, i) => `Passage ${i + 1}`));
    expect(parts[1].offset).toBe(allQuestions(sets[0].groups).length);
    expect(parts.every((p) => p.passage)).toBe(true);
  });

  it("orders the full listening test by section and keeps audio", () => {
    const parts = listeningParts(resolveListeningSets(FULL_TEST_ID)!);
    expect(parts[0].audioSrc).toMatch(/^\/listening\/.+\.mp3$/);
    expect(parts.map((p) => p.label)[0]).toBe("Part 1");
  });

  it("returns null for unknown sets", () => {
    expect(resolveReadingSets("nope")).toBeNull();
    expect(resolveListeningSets("nope")).toBeNull();
  });
});

describe("talking examiner", () => {
  it("asks every question in order, with the Part 2 card between Parts 1 and 3", () => {
    const set = speakingSets[0];
    const steps = buildSteps(set);
    const kinds = steps.map((s) => (s.kind === "ask" ? `ask-${s.part}` : s.kind === "say" ? s.key : s.kind));
    expect(kinds.filter((k) => k === "ask-1")).toHaveLength(set.part1.length);
    expect(kinds.filter((k) => k === "ask-3")).toHaveLength(set.part3.length);
    expect(kinds.indexOf("cue")).toBeGreaterThan(kinds.lastIndexOf("ask-1"));
    expect(kinds.indexOf("longTurn")).toBeLessThan(kinds.indexOf("ask-3"));
    expect(kinds[0]).toBe("welcome");
    expect(kinds.at(-1)).toBe("end");
    for (const step of steps) if (step.kind === "say") expect(EXAMINER_LINES[step.key]).toBeTruthy();
  });

  it("builds clip paths and the cue card script", () => {
    expect(examinerAudioSrc("welcome")).toBe("/speaking/common/welcome.mp3");
    expect(examinerAudioSrc("p1-0", "abc")).toBe("/speaking/abc/p1-0.mp3");
    expect(cueCardScript(speakingSets[0])).toContain("You should say:");
  });

  it("tells the AI when a recording is a whole test", () => {
    expect(buildSpeakingContext(speakingSets[0], 600, true)).toContain("complete Speaking test");
    expect(buildSpeakingContext(speakingSets[0], 60)).not.toContain("complete Speaking test");
  });
});
