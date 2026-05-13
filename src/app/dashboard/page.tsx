"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnalyticsOverview } from "@/components/AnalyticsOverview";
import { AudioRecorder } from "@/components/AudioRecorder";
import { IeltsPracticeHub } from "@/components/IeltsPracticeHub";
import { ProgressChart, type BandPoint } from "@/components/ProgressChart";
import type { IeltsModule } from "@/lib/ielts/practice-data";

type TestRow = {
  id: string;
  bandScore: number;
  transcript: string;
  summary?: string;
  breakdown: {
    fluency: number;
    lexicalResource: number;
    grammaticalRange: number;
    pronunciation: number;
  };
  date: string;
};

type AttemptRow = {
  id: string;
  module: IeltsModule;
  title: string;
  score: number;
  rawScore?: number;
  totalQuestions?: number;
  summary?: string;
  date: string;
};

export default function DashboardPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [latest, setLatest] = useState<TestRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [speakingRes, attemptsRes] = await Promise.all([
        fetch("/api/exam/results", { credentials: "include" }),
        fetch("/api/practice/attempts", { credentials: "include" }),
      ]);
      const speakingData = await speakingRes.json();
      const attemptsData = await attemptsRes.json();
      if (!speakingRes.ok) throw new Error(speakingData.error ?? "Failed to load speaking results");
      if (!attemptsRes.ok) throw new Error(attemptsData.error ?? "Failed to load practice attempts");
      setTests(speakingData.tests ?? []);
      setAttempts(attemptsData.attempts ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chartData: BandPoint[] = tests.map((t, i) => ({
    label: `T${i + 1}`,
    band: t.bandScore,
  }));

  const allModuleChartData: BandPoint[] = attempts.map((attempt, i) => ({
    label: `${attempt.module[0].toUpperCase()}${i + 1}`,
    band: attempt.score,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">IELTS Practice</p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Exam preparation dashboard</h1>
          </div>
          <button
            type="button"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {loadError && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {loadError}
          </p>
        )}

        <AnalyticsOverview attempts={attempts} />

        <div className="grid gap-8 lg:grid-cols-2">
          <AudioRecorder
            onComplete={(p) => {
              setLatest({
                id: "latest",
                bandScore: p.bandScore,
                transcript: p.transcript,
                summary: p.summary,
                breakdown: p.breakdown as TestRow["breakdown"],
                date: new Date().toISOString(),
              });
              void refresh();
            }}
          />
          <div className="space-y-4">
            <ProgressChart data={chartData} />
            {latest && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Latest breakdown</p>
                <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                  <li>Fluency: {latest.breakdown.fluency}</li>
                  <li>Lexical resource: {latest.breakdown.lexicalResource}</li>
                  <li>Grammar: {latest.breakdown.grammaticalRange}</li>
                  <li>Pronunciation (est.): {latest.breakdown.pronunciation}</li>
                </ul>
                {latest.summary && (
                  <p className="mt-3 border-t border-zinc-100 pt-3 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                    {latest.summary}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <IeltsPracticeHub attempts={attempts} onAttemptSaved={refresh} />

        {allModuleChartData.length > 0 && (
          <ProgressChart data={allModuleChartData} title="All-module progress" emptyLabel="Complete any module to see progress." />
        )}

        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Recent transcripts</h2>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[...tests].reverse().map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Band {t.bandScore}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(t.date).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{t.transcript}</p>
                {t.summary && (
                  <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">{t.summary}</p>
                )}
              </li>
            ))}
            {tests.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">No tests yet.</li>
            )}
          </ul>
        </section>

        <p className="text-center text-sm text-zinc-500">
          <Link href="/" className="text-emerald-700 hover:underline dark:text-emerald-400">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
