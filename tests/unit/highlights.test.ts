import { describe, expect, it } from "vitest";
import { addRange, removeRange, segments } from "@/lib/highlights";

describe("highlights", () => {
  it("merges overlapping and touching ranges", () => {
    expect(addRange([[0, 5]], [3, 8])).toEqual([[0, 8]]);
    expect(addRange([[0, 5]], [5, 7])).toEqual([[0, 7]]);
    expect(addRange([[10, 12]], [0, 2])).toEqual([[0, 2], [10, 12]]);
  });

  it("clears part of a range", () => {
    expect(removeRange([[0, 10]], [3, 6])).toEqual([[0, 3], [6, 10]]);
    expect(removeRange([[0, 10]], [0, 10])).toEqual([]);
    expect(removeRange([[0, 2], [5, 9]], [1, 6])).toEqual([[0, 1], [6, 9]]);
  });

  it("splits text into marked segments and ignores out-of-range values", () => {
    expect(segments("hello world", [[6, 11]])).toEqual([
      { text: "hello ", marked: false, start: 0 },
      { text: "world", marked: true, start: 6 },
    ]);
    expect(segments("abc", [[2, 99], [1, 2]]).map((s) => s.text).join("")).toBe("abc");
    expect(segments("abc", [])).toEqual([{ text: "abc", marked: false, start: 0 }]);
  });
});
