"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListeningAudioPlayer } from "@/components/ListeningAudioPlayer";
import { TimedSpeakingMode } from "@/components/TimedSpeakingMode";
import {
  ieltsOverview,
  listeningPractice,
  listeningPracticeSets,
  normalizeAnswer,
  readingPractice,
  readingPracticeSets,
  speakingPrompts,
  speakingSets,
  writingTasks,
  type IeltsModule,
} from "@/lib/ielts/practice-data";

type Attempt = {
  id: string;
  module: IeltsModule;
  title: string;
  score: number;
  rawScore?: number;
  totalQuestions?: number;
  summary?: string;
  date: string;
};

type Props = {
  attempts: Attempt[];
  onAttemptSaved?: () => void;
};

const modules: Array<{ id: IeltsModule; label: string }> = [
  { id: "speaking", label: "Speaking" },
  { id: "writing", label: "Writing" },
  { id: "reading", label: "Reading" },
  { id: "listening", label: "Listening" },
];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function IeltsPracticeHub({ attempts, onAttemptSaved }: Props) {
  const [active, setActive] = useState<IeltsModule>("writing");
  const [writingTaskId, setWritingTaskId] = useState(writingTasks[1].id);
  const [speakingSetId, setSpeakingSetId] = useState(speakingSets[0].id);
  const [readingSetId, setReadingSetId] = useState(readingPractice.id);
  const [listeningSetId, setListeningSetId] = useState(listeningPractice.id);
  const [writingAnswer, setWritingAnswer] = useState("");
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingPending, setWritingPending] = useState(false);
  const [writingResult, setWritingResult] = useState<{
    bandScore: number;
    summary: string;
    strengths: string[];
    improvements: string[];
    breakdown: Record<string, number>;
  } | null>(null);

  const [readingAnswers, setReadingAnswers] = useState<Record<string, string>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [drillResult, setDrillResult] = useState<string | null>(null);

  const selectedWritingTask = writingTasks.find((task) => task.id === writingTaskId) ?? writingTasks[0];
  const selectedSpeakingSet = speakingSets.find((set) => set.id === speakingSetId) ?? speakingPrompts;
  const selectedReadingSet = readingPracticeSets.find((set) => set.id === readingSetId) ?? readingPractice;
  const selectedListeningSet = listeningPracticeSets.find((set) => set.id === listeningSetId) ?? listeningPractice;
  const selectedWordCount = wordCount(writingAnswer);

  const analytics = useMemo(
    () =>
      modules.map((module) => {
        const rows = attempts.filter((attempt) => attempt.module === module.id);
        return {
          ...module,
          count: rows.length,
          average: average(rows.map((row) => row.score)),
          latest: rows.at(-1)?.score ?? null,
        };
      }),
    [attempts]
  );

  async function saveDrillAttempt(input: {
    module: "reading" | "listening";
    title: string;
    answers: Record<string, string>;
    questions: Array<{ id: string; answer: string }>;
  }) {
    const rawScore = input.questions.filter(
      (question) => normalizeAnswer(input.answers[question.id] ?? "") === normalizeAnswer(question.answer)
    ).length;

    const res = await fetch("/api/practice/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        module: input.module,
        title: input.title,
        rawScore,
        totalQuestions: input.questions.length,
        summary: `${rawScore}/${input.questions.length} correct`,
        details: {
          answers: input.answers,
          answerKey: input.questions.map((q) => ({ id: q.id, answer: q.answer })),
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDrillResult(typeof data.error === "string" ? data.error : "Could not save attempt");
      return;
    }

    setDrillResult(`${input.title}: ${rawScore}/${input.questions.length} correct saved.`);
    onAttemptSaved?.();
  }

  async function submitWriting() {
    setWritingError(null);
    setWritingResult(null);

    if (selectedWordCount < selectedWritingTask.minWords) {
      setWritingError(`Write at least ${selectedWritingTask.minWords} words before submitting.`);
      return;
    }

    setWritingPending(true);
    try {
      const res = await fetch("/api/writing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskLabel: selectedWritingTask.label,
          prompt: selectedWritingTask.prompt,
          answer: writingAnswer,
          minWords: selectedWritingTask.minWords,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWritingError(typeof data.error === "string" ? data.error : "Writing evaluation failed");
        return;
      }
      setWritingResult(data.evaluation);
      onAttemptSaved?.();
    } finally {
      setWritingPending(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {analytics.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {item.average ?? "-"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {item.count} attempts{item.latest != null ? `, latest ${item.latest}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">IELTS practice centre</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Practice all four IELTS modules with timed tasks, answer checks, AI scoring, and progress tracking.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => {
                  setActive(module.id);
                  setDrillResult(null);
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active === module.id
                    ? "bg-emerald-600 text-white"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {module.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {active === "speaking" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {speakingSets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setSpeakingSetId(set.id)}
                    className={`rounded-md px-3 py-2 text-sm ${
                      set.id === speakingSetId
                        ? "bg-emerald-600 text-white"
                        : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {set.title}
                  </button>
                ))}
              </div>
              <TimedSpeakingMode />
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Part 1: Interview</p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {selectedSpeakingSet.part1.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Part 2: Cue card</p>
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{selectedSpeakingSet.part2.cue}</p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {selectedSpeakingSet.part2.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Part 3: Discussion</p>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {selectedSpeakingSet.part3.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {active === "writing" && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                <Link
                  href="/writing/history"
                  className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-300"
                >
                  Open writing history and revision diff
                </Link>
                <Link
                  href="/writing/task2"
                  className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-300"
                >
                  Open timed Writing Task 2 exam mode
                </Link>
                {writingTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setWritingTaskId(task.id);
                      setWritingResult(null);
                      setWritingError(null);
                    }}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${
                      task.id === writingTaskId
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                    }`}
                  >
                    <span className="font-semibold">{task.label}</span>
                    <span className="mt-1 block text-xs">{task.minutes} min, minimum {task.minWords} words</span>
                  </button>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{selectedWritingTask.prompt}</p>
                <textarea
                  value={writingAnswer}
                  onChange={(e) => setWritingAnswer(e.target.value)}
                  className="mt-3 min-h-72 w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none ring-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  placeholder="Write your answer here..."
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">
                    {selectedWordCount} words / minimum {selectedWritingTask.minWords}
                  </p>
                  <button
                    type="button"
                    onClick={submitWriting}
                    disabled={writingPending}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {writingPending ? "Scoring..." : "Score writing"}
                  </button>
                </div>
                {writingError && (
                  <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                    {writingError}
                  </p>
                )}
                {writingResult && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                      Band {writingResult.bandScore}
                    </p>
                    <p className="mt-2 text-zinc-700 dark:text-zinc-200">{writingResult.summary}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">Strengths</p>
                        <ul className="mt-1 space-y-1 text-zinc-700 dark:text-zinc-300">
                          {writingResult.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">Improve next</p>
                        <ul className="mt-1 space-y-1 text-zinc-700 dark:text-zinc-300">
                          {writingResult.improvements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {active === "reading" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-lg bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <div className="mb-4 flex flex-wrap gap-2">
                  {readingPracticeSets.map((set) => (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => {
                        setReadingSetId(set.id);
                        setReadingAnswers({});
                        setDrillResult(null);
                      }}
                      className={`rounded-md px-3 py-2 text-xs ${
                        set.id === readingSetId
                          ? "bg-emerald-600 text-white"
                          : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {set.title.replace("Academic Reading ", "")}
                    </button>
                  ))}
                </div>
                <h3 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">{selectedReadingSet.title}</h3>
                {selectedReadingSet.passage}
              </article>
              <div className="space-y-3">
                {selectedReadingSet.questions.map((question) => (
                  <label key={question.id} className="block text-sm">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{question.question}</span>
                    <input
                      value={readingAnswers[question.id] ?? ""}
                      onChange={(e) =>
                        setReadingAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    void saveDrillAttempt({
                      module: "reading",
                      title: selectedReadingSet.title,
                      answers: readingAnswers,
                      questions: selectedReadingSet.questions,
                    })
                  }
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Check and save
                </button>
              </div>
            </div>
          )}

          {active === "listening" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
                <div className="mb-4 flex flex-wrap gap-2">
                  {listeningPracticeSets.map((set) => (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => {
                        setListeningSetId(set.id);
                        setListeningAnswers({});
                        setDrillResult(null);
                      }}
                      className={`rounded-md px-3 py-2 text-xs ${
                        set.id === listeningSetId
                          ? "bg-emerald-600 text-white"
                          : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {set.title.replace("Listening ", "")}
                    </button>
                  ))}
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{selectedListeningSet.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Play the pre-recorded MP3 once, then answer the completion questions.
                </p>
                <div className="mt-4">
                  <ListeningAudioPlayer src={selectedListeningSet.audioSrc} />
                </div>
              </div>
              <div className="space-y-3">
                {selectedListeningSet.questions.map((question) => (
                  <label key={question.id} className="block text-sm">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{question.question}</span>
                    <input
                      value={listeningAnswers[question.id] ?? ""}
                      onChange={(e) =>
                        setListeningAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    void saveDrillAttempt({
                      module: "listening",
                      title: selectedListeningSet.title,
                      answers: listeningAnswers,
                      questions: selectedListeningSet.questions,
                    })
                  }
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Check and save
                </button>
              </div>
            </div>
          )}

          {drillResult && (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {drillResult}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {ieltsOverview.map((item) => (
          <div key={item.module} className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{item.duration}</p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.format}</p>
            <p className="mt-2 text-xs text-zinc-500">{item.focus}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
