/**
 * IELTS band arithmetic shared by server grading and client display.
 */

/**
 * Rounds to the IELTS half-band convention: a fractional .25 rounds up to
 * .5 and .75 rounds up to the next whole band (6.25 → 6.5, 6.75 → 7,
 * 6.125 → 6).
 */
export function roundToHalfBand(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(9, Math.max(0, value));
  return Math.round(clamped * 2 + 1e-9) / 2;
}

/** Overall band from criterion scores (speaking or writing). */
export function overallFromCriteria(criteria: number[]): number {
  if (criteria.length === 0) return 0;
  const mean = criteria.reduce((sum, value) => sum + value, 0) / criteria.length;
  return roundToHalfBand(mean);
}

type BandRow = readonly [minRawOutOf40: number, band: number];

/** Raw score (out of 40) to band — IELTS Listening conversion table. */
const LISTENING_TABLE: readonly BandRow[] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [32, 7.5],
  [30, 7],
  [26, 6.5],
  [23, 6],
  [18, 5.5],
  [16, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [2, 1.5],
  [1, 1],
];

/** Raw score (out of 40) to band — IELTS Academic Reading conversion table. */
const ACADEMIC_READING_TABLE: readonly BandRow[] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [33, 7.5],
  [30, 7],
  [27, 6.5],
  [23, 6],
  [19, 5.5],
  [15, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
  [3, 2],
  [2, 1.5],
  [1, 1],
];

/**
 * Converts a raw score to an estimated band. Sets shorter than 40 questions
 * are scaled to a 40-question equivalent first, so the result is an
 * estimate, which the UI labels as such.
 */
export function rawToBand(module: "listening" | "reading", raw: number, total: number): number {
  if (!Number.isFinite(raw) || !Number.isFinite(total) || total <= 0) return 0;
  const safeRaw = Math.min(Math.max(0, Math.floor(raw)), total);
  const outOf40 = Math.round((safeRaw / total) * 40);
  const table = module === "listening" ? LISTENING_TABLE : ACADEMIC_READING_TABLE;
  for (const [min, band] of table) {
    if (outOf40 >= min) return band;
  }
  return 0;
}

export function formatBand(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return Number.isInteger(value) ? `${value}.0` : String(value);
}
