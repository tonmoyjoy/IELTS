import { roundToHalfBand } from "@/lib/bands";

export const MOCK_ORDER = ["listening", "reading", "writing", "speaking"] as const;
export type MockSectionName = (typeof MOCK_ORDER)[number];

/** Server-enforced time per section (seconds). Listening covers the recording plus checking time. */
export const MOCK_SECTION_SECONDS: Record<MockSectionName, number> = {
  listening: 40 * 60,
  reading: 60 * 60,
  writing: 60 * 60,
  speaking: 20 * 60,
};

/** Allowance for slow networks and auto-submit before a section counts as late. */
export const MOCK_GRACE_SECONDS = 120;

export function nextSection(section: MockSectionName): MockSectionName | "done" {
  const index = MOCK_ORDER.indexOf(section);
  return index < MOCK_ORDER.length - 1 ? MOCK_ORDER[index + 1] : "done";
}

/** Task 2 carries twice the weight of Task 1. */
export function writingBand(task1: number, task2: number): number {
  return roundToHalfBand((task1 + 2 * task2) / 3);
}

/** Overall band: mean of the four section bands, rounded the IELTS way. */
export function overallBand(bands: number[]): number {
  if (bands.length === 0) return 0;
  return roundToHalfBand(bands.reduce((sum, band) => sum + band, 0) / bands.length);
}
