import { describe, expect, it } from "vitest";
import { formatBand, overallFromCriteria, rawToBand, roundToHalfBand } from "@/lib/bands";

describe("roundToHalfBand", () => {
  it.each([
    [6.25, 6.5],
    [6.75, 7],
    [6.125, 6],
    [6.5, 6.5],
    [6.74, 6.5],
    [8.9, 9],
    [-1, 0],
    [12, 9],
    [Number.NaN, 0],
  ])("rounds %s to %s", (input, expected) => {
    expect(roundToHalfBand(input)).toBe(expected);
  });
});

describe("overallFromCriteria", () => {
  it("averages and applies IELTS rounding", () => {
    expect(overallFromCriteria([6, 6, 6, 7])).toBe(6.5); // 6.25 → 6.5
    expect(overallFromCriteria([7, 7, 7, 6])).toBe(7); // 6.75 → 7
    expect(overallFromCriteria([6, 6, 6, 6.5])).toBe(6); // 6.125 → 6
    expect(overallFromCriteria([])).toBe(0);
  });
});

describe("rawToBand", () => {
  it("maps full-length raw scores using the published tables", () => {
    expect(rawToBand("listening", 40, 40)).toBe(9);
    expect(rawToBand("listening", 30, 40)).toBe(7);
    expect(rawToBand("listening", 23, 40)).toBe(6);
    expect(rawToBand("reading", 30, 40)).toBe(7);
    expect(rawToBand("reading", 23, 40)).toBe(6);
    expect(rawToBand("reading", 0, 40)).toBe(0);
  });

  it("scales shorter sets to a 40-question equivalent", () => {
    expect(rawToBand("reading", 12, 12)).toBe(9);
    expect(rawToBand("reading", 9, 12)).toBe(7); // 30/40
    expect(rawToBand("listening", 5, 10)).toBe(5.5); // 20/40
  });

  it("never trusts out-of-range input", () => {
    expect(rawToBand("reading", 400, 12)).toBe(9);
    expect(rawToBand("reading", -5, 12)).toBe(0);
    expect(rawToBand("reading", 5, 0)).toBe(0);
  });
});

describe("formatBand", () => {
  it("formats whole and half bands", () => {
    expect(formatBand(7)).toBe("7.0");
    expect(formatBand(6.5)).toBe("6.5");
    expect(formatBand(null)).toBe("–");
  });
});
