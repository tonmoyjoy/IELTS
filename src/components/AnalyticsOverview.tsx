"use client";

import Link from "next/link";
import type { IeltsModule } from "@/lib/ielts/practice-data";

type Attempt = {
  id: string;
  module: IeltsModule;
  title: string;
  score: number;
  date: string;
};

type Props = {
  attempts: Attempt[];
};

const moduleMeta: Record<IeltsModule, { label: string; icon: string; note: string }> = {
  listening: { label: "Listening", icon: "headphones", note: "Detail and completion accuracy" },
  reading: { label: "Reading", icon: "book", note: "Skimming, scanning, detail" },
  writing: { label: "Writing", icon: "edit", note: "Cohesion and task response" },
  speaking: { label: "Speaking", icon: "mic", note: "Fluency and extended answers" },
};

function average(scores: number[]) {
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function pct(score: number | null) {
  return `${Math.min(100, Math.round(((score ?? 0) / 9) * 100))}%`;
}

function moduleAverage(attempts: Attempt[], module: IeltsModule) {
  return average(attempts.filter((attempt) => attempt.module === module).map((attempt) => attempt.score));
}

export function AnalyticsOverview({ attempts }: Props) {
  const modules = Object.keys(moduleMeta) as IeltsModule[];
  const moduleScores = modules.map((module) => ({
    module,
    score: moduleAverage(attempts, module),
  }));
  const overall = average(moduleScores.map((item) => item.score).filter((score): score is number => score != null));
  const weakest = [...moduleScores]
    .filter((item) => item.score != null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const recent = attempts.slice(-8);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Performance Analytics
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Track your IELTS practice trend, compare module performance, and focus your next session where it
          will move your band score the most.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 lg:grid-cols-12">
        <div className="col-span-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated band score</h3>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Target 8.0
            </span>
          </div>
          <p className="mt-4 text-5xl font-bold text-emerald-700 dark:text-emerald-400">{overall ?? "-"}</p>
          <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: pct(overall) }} />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {attempts.length === 0 ? "Complete a practice task to start tracking." : `${attempts.length} saved attempts`}
            </p>
          </div>
        </div>

        <div className="col-span-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">30-day trend</h3>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-950">All</span>
              <span className="rounded-full px-3 py-1 text-zinc-500">Mock tests</span>
            </div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2 border-b border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {(recent.length ? recent : Array.from({ length: 8 }, () => null)).map((attempt, index) => {
              const score = attempt?.score ?? 0;
              return (
                <div key={attempt?.id ?? index} className="group relative flex flex-1 items-end">
                  <div
                    className={`w-full rounded-t-sm transition-colors ${
                      attempt ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    style={{ height: attempt ? pct(score) : "18%" }}
                  />
                  {attempt && (
                    <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block">
                      {score}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-zinc-500">
            <span>Oldest</span>
            <span>Latest</span>
          </div>
        </div>

        <div className="col-span-4 mt-4 flex items-center justify-between lg:col-span-12">
          <h3 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Module Breakdown</h3>
          <Link href="/writing/history" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
            View History
          </Link>
        </div>

        {moduleScores.map(({ module, score }) => {
          const meta = moduleMeta[module];
          const isWeakest = weakest?.module === module;
          return (
            <div
              key={module}
              className={`col-span-4 rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 md:col-span-2 lg:col-span-3 ${
                isWeakest ? "border-l-4 border-l-rose-600 border-zinc-200 dark:border-zinc-800" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-semibold text-emerald-700 dark:bg-zinc-950 dark:text-emerald-300">
                  {meta.icon}
                </div>
                <span className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{score ?? "-"}</span>
              </div>
              <h4 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{meta.label}</h4>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: pct(score) }} />
              </div>
              <p className={`mt-2 text-xs ${isWeakest ? "text-rose-600" : "text-zinc-500"}`}>
                {isWeakest ? "Recommended focus" : meta.note}
              </p>
            </div>
          );
        })}

        <div className="col-span-4 mt-4 lg:col-span-12">
          <h3 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Recommended Focus Areas</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex gap-4 rounded-r-lg border-l-4 border-emerald-600 bg-zinc-100 p-5 dark:bg-zinc-900">
              <div className="h-fit rounded-full bg-white p-2 text-emerald-700 shadow-sm dark:bg-zinc-950">idea</div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Task 2 Writing: Cohesion</h4>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Practise paragraph transitions and clear topic sentences before your next essay submission.
                </p>
                <Link href="/writing/task2" className="mt-3 inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950">
                  Start Exercise
                </Link>
              </div>
            </div>
            <div className="flex gap-4 rounded-r-lg border-l-4 border-teal-600 bg-zinc-100 p-5 dark:bg-zinc-900">
              <div className="h-fit rounded-full bg-white p-2 text-teal-700 shadow-sm dark:bg-zinc-950">voice</div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Speaking Part 3: Extend Answers</h4>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Use point, explain, example to turn short answers into stronger discussion responses.
                </p>
                <Link href="/dashboard" className="mt-3 inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-teal-700 hover:border-teal-600 dark:border-zinc-700 dark:bg-zinc-950">
                  Review Lesson
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
