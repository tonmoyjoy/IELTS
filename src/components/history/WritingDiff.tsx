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
      <p className="text-xs text-zinc-500">
        <span className="font-medium text-emerald-700 dark:text-emerald-400">+{added} words</span> ·{" "}
        <span className="font-medium text-rose-700 dark:text-rose-400">−{removed} words</span> compared with the earlier attempt
      </p>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">
        {parts.map((part, index) =>
          part.added ? (
            <ins key={index} className="rounded bg-emerald-100 px-0.5 text-emerald-900 no-underline dark:bg-emerald-900/50 dark:text-emerald-100">
              {part.value}
            </ins>
          ) : part.removed ? (
            <del key={index} className="rounded bg-rose-100 px-0.5 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100">
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
