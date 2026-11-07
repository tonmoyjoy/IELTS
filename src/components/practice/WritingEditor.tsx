"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { countWords, formatDuration } from "@/lib/text";
import { Alert, BandBadge, Button, ButtonLink, Card } from "@/components/ui";
import { CriteriaTable, FeedbackLists } from "@/components/practice/CriteriaTable";

type Evaluation = {
  bandScore: number;
  criteria: { taskResponse: number; coherenceCohesion: number; lexicalResource: number; grammaticalRange: number };
  summary: string;
  strengths: string[];
  improvements: string[];
  wordCount: number;
  underLength: boolean;
};

type Props = {
  taskId: string;
  taskNumber: 1 | 2;
  minutes: number;
  minWords: number;
  remainingEvaluations: number;
};

export function WritingEditor({ taskId, taskNumber, minutes, minWords, remainingEvaluations }: Props) {
  const router = useRouter();
  const draftKey = `ielts:draft:writing:${taskId}`;
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [result, setResult] = useState<{ evaluation: Evaluation; attemptId: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const words = countWords(answer);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setAnswer(saved);
    } catch {
      // storage unavailable
    }
  }, [draftKey]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  function onChange(value: string) {
    setAnswer(value);
    if (!timerRunning && secondsLeft === minutes * 60 && value.trim()) setTimerRunning(true);
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      // ignore
    }
  }

  async function submit() {
    setError(null);
    setPending(true);
    setTimerRunning(false);
    const res = await apiFetch<{ evaluation: Evaluation; attempt: { id: string } }>("/api/writing/evaluate", {
      body: { taskId, answer },
    });
    setPending(false);
    if (!res.ok) {
      setError({ message: res.error, code: res.code });
      return;
    }
    setResult({ evaluation: res.data.evaluation, attemptId: res.data.attempt.id });
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    router.refresh();
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const lowTime = secondsLeft <= 5 * 60;
  const criterionOne = taskNumber === 1 ? "Task Achievement" : "Task Response";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3 text-sm">
            <span className={`font-semibold tabular-nums ${lowTime ? "text-rose-600" : ""}`} aria-live="off">
              {formatDuration(secondsLeft)}
            </span>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setTimerRunning((v) => !v)} disabled={secondsLeft === 0 || Boolean(result)}>
              {timerRunning ? "Pause timer" : secondsLeft === minutes * 60 ? "Start timer" : "Resume timer"}
            </Button>
          </div>
          <span className={`text-sm tabular-nums ${words >= minWords ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"}`}>
            {words} / {minWords} words
          </span>
        </div>
        <label htmlFor="answer" className="sr-only">Your answer</label>
        <textarea
          id="answer"
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          readOnly={Boolean(result)}
          spellCheck={false}
          placeholder="Start writing your answer here. The timer starts when you begin typing."
          className="block min-h-[26rem] w-full resize-y border-0 bg-white p-4 text-[15px] leading-7 text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Spell-check is off, as in the real test. Drafts are saved on this device. {remainingEvaluations} evaluation
            {remainingEvaluations === 1 ? "" : "s"} left today.
          </p>
          {!result && (
            <Button onClick={submit} disabled={pending || words < 50 || remainingEvaluations === 0}>
              {pending ? "Scoring… (up to a minute)" : "Submit for scoring"}
            </Button>
          )}
        </div>
      </Card>

      {words > 0 && words < minWords && !result && (
        <Alert tone="warning">
          Task {taskNumber} needs at least {minWords} words. Shorter answers are penalised under {criterionOne}.
        </Alert>
      )}
      {error && (
        <Alert tone="error">
          {error.message}
          {error.code === "QUOTA_EXCEEDED" && (
            <> <Link href="/dashboard" className="font-medium underline">See your usage</Link></>
          )}
        </Alert>
      )}

      {result && (
        <div ref={resultRef}>
          <Card className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Examiner feedback</h2>
              <BandBadge score={result.evaluation.bandScore} size="lg" />
            </div>
            {result.evaluation.underLength && (
              <Alert tone="warning">This answer was under {minWords} words, which lowers the {criterionOne} score.</Alert>
            )}
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{result.evaluation.summary}</p>
            <CriteriaTable
              rows={[
                { label: criterionOne, score: result.evaluation.criteria.taskResponse },
                { label: "Coherence and Cohesion", score: result.evaluation.criteria.coherenceCohesion },
                { label: "Lexical Resource", score: result.evaluation.criteria.lexicalResource },
                { label: "Grammatical Range and Accuracy", score: result.evaluation.criteria.grammaticalRange },
              ]}
            />
            <FeedbackLists strengths={result.evaluation.strengths} improvements={result.evaluation.improvements} />
            <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <ButtonLink href={`/history/${result.attemptId}`} variant="secondary">Open in history</ButtonLink>
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setSecondsLeft(minutes * 60);
                }}
              >
                Revise and resubmit
              </Button>
            </div>
            <p className="text-xs text-zinc-500">AI feedback is a practice estimate, not an official IELTS score.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
