"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type WritingAttempt = {
  id: string;
  module: "writing";
  title: string;
  score: number;
  summary?: string;
  details?: {
    answer?: string;
    prompt?: string;
    improvements?: string[];
    strengths?: string[];
  };
  date: string;
};

function diffWords(before: string, after: string) {
  const a = before.trim().split(/\s+/).filter(Boolean);
  const b = after.trim().split(/\s+/).filter(Boolean);
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = a[i - 1] === b[j - 1] ? rows[i - 1][j - 1] + 1 : Math.max(rows[i - 1][j], rows[i][j - 1]);
    }
  }

  const removed: string[] = [];
  const added: string[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || rows[i][j - 1] >= rows[i - 1][j])) {
      added.push(b[j - 1]);
      j -= 1;
    } else if (i > 0) {
      removed.push(a[i - 1]);
      i -= 1;
    }
  }

  const addedSet = new Set(added);
  const removedSet = new Set(removed);
  return { addedSet, removedSet };
}

function HighlightedText({
  text,
  words,
  type,
}: {
  text: string;
  words: Set<string>;
  type: "added" | "removed";
}) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
      {text.split(/(\s+)/).map((part, index) => {
        const clean = part.trim();
        const active = clean && words.has(clean);
        return (
          <span
            key={`${part}-${index}`}
            className={
              active
                ? type === "added"
                  ? "rounded bg-emerald-100 px-0.5 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                  : "rounded bg-rose-100 px-0.5 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100"
                : undefined
            }
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}

export function WritingHistoryClient() {
  const [attempts, setAttempts] = useState<WritingAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/practice/attempts", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load writing history");
        return;
      }
      setAttempts((data.attempts ?? []).filter((attempt: WritingAttempt) => attempt.module === "writing"));
    }
    void load();
  }, []);

  const comparison = useMemo(() => {
    const withAnswers = attempts.filter((attempt) => attempt.details?.answer);
    if (withAnswers.length < 2) return null;
    const sorted = [...withAnswers].sort((a, b) => a.score - b.score);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const diff = diffWords(low.details?.answer ?? "", high.details?.answer ?? "");
    return { low, high, diff };
  }, [attempts]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Writing history</p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Revision comparison</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {!comparison && (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            Submit at least two writing attempts to unlock side-by-side revision comparison.
          </div>
        )}

        {comparison && (
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Earlier attempt</h2>
                <span className="rounded-md bg-rose-50 px-2 py-1 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  Band {comparison.low.score}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{comparison.low.title}</p>
              <div className="mt-4">
                <HighlightedText
                  text={comparison.low.details?.answer ?? ""}
                  words={comparison.diff.removedSet}
                  type="removed"
                />
              </div>
            </article>

            <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Best attempt</h2>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  Band {comparison.high.score}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{comparison.high.title}</p>
              <div className="mt-4">
                <HighlightedText
                  text={comparison.high.details?.answer ?? ""}
                  words={comparison.diff.addedSet}
                  type="added"
                />
              </div>
            </article>
          </section>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">All writing attempts</h2>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[...attempts].reverse().map((attempt) => (
              <li key={attempt.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{attempt.title}</span>
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">Band {attempt.score}</span>
                </div>
                {attempt.summary && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{attempt.summary}</p>}
              </li>
            ))}
            {attempts.length === 0 && <li className="px-4 py-8 text-center text-sm text-zinc-500">No writing attempts yet.</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
