/** Pure helpers for passage highlighting (see components/cbt/Highlighter.tsx). */

export type Range = [start: number, end: number];
export type Highlights = Record<string, Range[]>;

/** Adds a range, merging anything it overlaps or touches. */
export function addRange(ranges: Range[], next: Range): Range[] {
  const all = [...ranges, next].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const [start, end] of all) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Removes the part of every range that falls inside `cut`. */
export function removeRange(ranges: Range[], cut: Range): Range[] {
  const out: Range[] = [];
  for (const [start, end] of ranges) {
    if (end <= cut[0] || start >= cut[1]) out.push([start, end]);
    else {
      if (start < cut[0]) out.push([start, cut[0]]);
      if (end > cut[1]) out.push([cut[1], end]);
    }
  }
  return out;
}

/** Splits text into plain and highlighted segments. */
export function segments(text: string, ranges: Range[]): Array<{ text: string; marked: boolean; start: number }> {
  const out: Array<{ text: string; marked: boolean; start: number }> = [];
  let cursor = 0;
  for (const [rawStart, rawEnd] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const start = Math.max(cursor, Math.min(rawStart, text.length));
    const end = Math.min(text.length, rawEnd);
    if (end <= start) continue;
    if (start > cursor) out.push({ text: text.slice(cursor, start), marked: false, start: cursor });
    out.push({ text: text.slice(start, end), marked: true, start });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), marked: false, start: cursor });
  return out;
}
