"use client";

import { useMemo } from "react";
import { diffWords } from "diff";

/** Word-level diff between two essays (Myers algorithm, O(ND)). */
export function WritingDiff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  const count = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
  const added = parts.filter((p) => p.added).reduce((n, p) => n + count(p.value), 0);
  const removed = parts.filter((p) => p.removed).reduce((n, p) => n + count(p.value), 0);

  return (
    <div>
      <p className="text-xs text-ink-faint">
        <span className="font-medium text-accent-text">+{added} words</span> ·{" "}
        <span className="font-medium text-bad">−{removed} words</span> compared with the earlier attempt
      </p>
      <p className="prose-reading mt-3 whitespace-pre-wrap">
        {parts.map((part, index) =>
          part.added ? (
            <ins key={index} className="rounded bg-good-soft px-0.5 text-good no-underline">
              {part.value}
            </ins>
          ) : part.removed ? (
            <del key={index} className="rounded bg-bad-soft px-0.5 text-bad">
              {part.value}
            </del>
          ) : (
            <span key={index}>{part.value}</span>
          )
        )}
      </p>
    </div>
  );
}
