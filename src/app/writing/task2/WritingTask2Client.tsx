"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const TASK_PROMPT =
  "Some people believe that unpaid community service should be a compulsory part of high school programmes, for example working for a charity, improving the neighbourhood or teaching sports to younger children.";

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function format(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function WritingTask2Client() {
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(40 * 60);
  const [running, setRunning] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    bandScore: number;
    summary: string;
    strengths: string[];
    improvements: string[];
  } | null>(null);

  const words = useMemo(() => wordCount(answer), [answer]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) setRunning(false);
  }, [secondsLeft]);

  async function submit() {
    setError(null);
    setResult(null);
    if (words < 250) {
      setError("Write at least 250 words before submitting.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/writing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskLabel: "Writing Task 2",
          prompt: `${TASK_PROMPT}\n\nTo what extent do you agree or disagree?`,
          answer,
          minWords: 250,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Writing evaluation failed");
        return;
      }
      setResult(data.evaluation);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf8fc] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="rounded-full p-2 text-emerald-700 hover:bg-zinc-100" aria-label="Back">
              menu
            </Link>
            <h1 className="text-2xl font-bold text-emerald-700">IELTS Master</h1>
          </div>
          <div className="flex items-center gap-3 rounded-sm border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm font-semibold">
            <span>Timer</span>
            <span className={secondsLeft < 300 ? "text-rose-700" : "text-zinc-950"}>{format(secondsLeft)}</span>
            <button type="button" onClick={() => setRunning((value) => !value)} className="text-xs text-emerald-700">
              {running ? "Pause" : "Resume"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-8">
        <section className="w-full overflow-y-auto md:w-1/2">
          <div className="flex min-h-full flex-col gap-4 rounded-lg border border-zinc-300 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
              <span className="rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-medium">Writing Task 2</span>
              <span className="text-xs font-medium text-zinc-500">40 minutes recommended</span>
            </div>
            <div className="mt-4 text-lg leading-8 text-zinc-800">
              <p className="font-bold text-zinc-950">You should spend about 40 minutes on this task.</p>
              <p className="mt-4">Write about the following topic:</p>
              <div className="my-6 rounded-sm border border-zinc-300 bg-zinc-100 p-6">
                <p className="italic">{TASK_PROMPT}</p>
              </div>
              <p className="font-bold text-zinc-950">To what extent do you agree or disagree?</p>
              <p className="mt-6 text-base text-zinc-600">
                Give reasons for your answer and include any relevant examples from your own knowledge or experience.
              </p>
              <p className="mt-2 text-base font-bold text-zinc-950">Write at least 250 words.</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-[620px] w-full flex-col rounded-lg border border-zinc-300 bg-white shadow-sm md:w-1/2">
          <div className="flex items-center gap-2 border-b border-zinc-300 bg-zinc-50 p-2">
            {["B", "I", "U"].map((item) => (
              <button key={item} type="button" className="rounded p-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
                {item}
              </button>
            ))}
            <div className="mx-1 h-6 w-px bg-zinc-300" />
            <button type="button" className="rounded p-2 text-sm text-zinc-600 hover:bg-zinc-100">Undo</button>
            <button type="button" className="rounded p-2 text-sm text-zinc-600 hover:bg-zinc-100">Redo</button>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="min-h-0 flex-1 resize-none border-none bg-white p-6 text-lg leading-8 text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:ring-0"
            placeholder="Start typing your essay here..."
          />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-zinc-300 bg-zinc-50 p-4">
            <div className="rounded-sm border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm text-zinc-600">
              Words: <strong className={words >= 250 ? "text-emerald-700" : "text-zinc-950"}>{words}</strong> / 250
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-sm bg-emerald-700 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? "Scoring..." : "Submit Task"}
            </button>
          </div>
        </section>
      </main>

      {(error || result) && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-4 shadow-xl">
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {result && (
            <div>
              <p className="text-lg font-semibold text-emerald-700">Band {result.bandScore}</p>
              <p className="mt-1 text-sm text-zinc-700">{result.summary}</p>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="font-medium text-zinc-950">Strengths</p>
                  <ul className="mt-1 space-y-1 text-zinc-600">
                    {result.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-zinc-950">Improve next</p>
                  <ul className="mt-1 space-y-1 text-zinc-600">
                    {result.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
