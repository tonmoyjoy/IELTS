import { describe, expect, it } from "vitest";
import { countWords, formatDuration, safeRedirectPath } from "@/lib/text";

describe("countWords", () => {
  it("counts whitespace-separated words and treats hyphenated words as one", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("a well-known fact")).toBe(3);
    expect(countWords("one\ntwo\tthree  four")).toBe(4);
  });

  it("ignores stray punctuation tokens", () => {
    expect(countWords("Yes - and no , really")).toBe(4);
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(-3)).toBe("0:00");
  });
});

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirectPath("/practice/reading?x=1#q2")).toBe("/practice/reading?x=1#q2");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/dashboard",
    "javascript:alert(1)",
    "dashboard",
    "/\u0000evil",
    "",
    null,
    undefined,
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value as string | null | undefined)).toBe("/dashboard");
  });
});
