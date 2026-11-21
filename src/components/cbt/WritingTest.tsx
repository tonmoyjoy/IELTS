"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { roundToHalfBand } from "@/lib/bands";
import { countWords } from "@/lib/text";
import type { WritingTask } from "@/content/types";
import { Alert, BandBadge, Button, ButtonLink, buttonClass } from "@/components/ui";
import { CriteriaTable, FeedbackLists } from "@/components/practice/CriteriaTable";
import { TaskVisual } from "@/components/practice/TaskVisual";
import { CbtShell, Modal, StartScreen } from "@/components/cbt/CbtShell";
import { loadJson, removeKey, saveJson, useCountdown, useElapsed, useLeaveWarning } from "@/components/cbt/hooks";

export type WritingEvaluation = {
  bandScore: number;
  criteria: { taskResponse: number; coherenceCohesion: number; lexicalResource: number; grammaticalRange: number };
  summary: string;
  strengths: string[];
  improvements: string[];
  wordCount: number;
  underLength: boolean;
};

export type WritingResult = { taskId: string; attemptId: string | null; evaluation: WritingEvaluation | null; skipped?: string };

type Draft = { mode: "exam" | "practice"; startedAt: number; answers: Record<string, string> };

/** Minimum the server accepts for AI scoring. */
const SCORABLE_WORDS = 50;

type Props = {
  tasks: WritingTask[];
  title: string;
  storageKey: string;
  exitHref: string;
  remainingEvaluations: number;
  mock?: { deadline: number; onSubmitted: (results: WritingResult[]) => Promise<void> };
};

export function WritingTest({ tasks, title, storageKey, exitHref, remainingEvaluations, mock }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<WritingResult[] | null>(null);
  const [done, setDone] = useState<Record<string, WritingResult>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);

  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);

  useEffect(() => {
    const saved = loadJson<Draft>(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a browser-only draft after hydration
    if (saved && typeof saved.startedAt === "number") setDraft({ ...saved, mode: mock ? "exam" : saved.mode });
    else if (mock) setDraft({ mode: "exam", startedAt: Date.now(), answers: {} });
    setRestored(true);
  }, [storageKey, mock]);

  useLeaveWarning(Boolean(draft) && !results && Object.values(draft?.answers ?? {}).some((a) => a.trim()));

  const deadline = !draft || results || draft.mode !== "exam" ? null : mock ? mock.deadline : draft.startedAt + totalMinutes * 60_000;

  const submit = useCallback(async () => {
    if (!draft) return;
    setConfirm(false);
    setError(null);
    const finished: Record<string, WritingResult> = { ...done };
    for (const task of tasks) {
      if (finished[task.id]) continue;
      const answer = draft.answers[task.id] ?? "";
      if (countWords(answer) < SCORABLE_WORDS) {
        finished[task.id] = { taskId: task.id, attemptId: null, evaluation: null, skipped: `Not scored: fewer than ${SCORABLE_WORDS} words (counts as band 0).` };
        continue;
      }
      setPending(task.id);
      const res = await apiFetch<{ evaluation: WritingEvaluation; attempt: { id: string } }>("/api/writing/evaluate", {
        body: { taskId: task.id, answer },
      });
      if (!res.ok) {
        setDone(finished);
        setPending(null);
        setError({ message: `Task ${task.task}: ${res.error} Your writing is saved on this device; press Submit again.`, code: res.code });
        return;
      }
      finished[task.id] = { taskId: task.id, attemptId: res.data.attempt.id, evaluation: res.data.evaluation };
    }
    setDone(finished);
    const ordered = tasks.map((task) => finished[task.id]);
    if (mock) {
      try {
        await mock.onSubmitted(ordered);
      } catch (e) {
        setPending(null);
        setError({ message: e instanceof Error ? e.message : "Could not save this section. Press Submit again.", code: "MOCK" });
        return;
      }
    }
    removeKey(storageKey);
    setPending(null);
    setResults(ordered);
    router.refresh();
  }, [draft, done, tasks, mock, storageKey, router]);

  const onExpire = useCallback(() => {
    setTimeUp(true);
    void submit();
  }, [submit]);
  const secondsLeft = useCountdown(deadline, onExpire);
  const elapsed = useElapsed(draft?.mode === "practice" && !results ? draft.startedAt : null);

  const overall = useMemo(() => {
    if (!results || tasks.length !== 2) return null;
    const [t1, t2] = results.map((r) => r.evaluation?.bandScore ?? 0);
    return roundToHalfBand((t1 + 2 * t2) / 3);
  }, [results, tasks.length]);

  if (!restored) return null;

  if (!draft) {
    return (
      <CbtShell title={title}>
        <div className="h-full overflow-y-auto">
          <StartScreen
            title={title}
            exitHref={exitHref}
            points={[
              tasks.length === 2 ? "Answer both tasks. Task 2 counts for twice as much as Task 1." : `Write at least ${tasks[0].minWords} words.`,
              `Suggested time: ${tasks.map((t) => `Task ${t.task} ${t.minutes} min`).join(", ")}.`,
              "The word count updates as you type. Spell-check is off, as in the real test.",
              `Each task you submit uses one AI evaluation (${remainingEvaluations} left today).`,
            ]}
            onStart={(mode) => {
              const fresh = { mode, startedAt: Date.now(), answers: {} };
              saveJson(storageKey, fresh);
              setDraft(fresh);
            }}
            modes={{
              exam: `${totalMinutes} minutes, then your writing is submitted automatically.`,
              practice: "No time limit. A stopwatch shows how long you take.",
            }}
          />
        </div>
      </CbtShell>
    );
  }

  const task = tasks[active];
  const answer = draft.answers[task.id] ?? "";
  const words = countWords(answer);
  const review = Boolean(results);
  const result = results?.[active];
  const scoringNeeded = tasks.filter((t) => !done[t.id] && countWords(draft.answers[t.id] ?? "") >= SCORABLE_WORDS).length;

  function setAnswer(value: string) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, answers: { ...current.answers, [task.id]: value } };
      saveJson(storageKey, next);
      return next;
    });
  }

  const footer = (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
      <div className="flex flex-1 gap-1.5">
        {tasks.map((t, index) => {
          const r = results?.[index];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${index === active ? "bg-accent-btn text-on-accent" : "border border-line-strong text-ink-soft hover:bg-sunken"}`}
            >
              Task {t.task}
              <span className="ml-2 text-xs tabular-nums opacity-80">{r?.evaluation ? `Band ${r.evaluation.bandScore}` : `${countWords(draft.answers[t.id] ?? "")} words`}</span>
            </button>
          );
        })}
      </div>
      {overall != null && (
        <span className="flex items-center gap-2 text-sm">
          Writing band <BandBadge score={overall} size="sm" />
        </span>
      )}
      {review ? (
        <Link href={exitHref} className={buttonClass("primary")}>
          {mock ? "Continue" : "Finish"}
        </Link>
      ) : (
        <Button onClick={() => setConfirm(true)} disabled={Boolean(pending)}>
          {pending ? `Scoring Task ${tasks.find((t) => t.id === pending)?.task}…` : "Submit"}
        </Button>
      )}
    </div>
  );

  return (
    <CbtShell
      title={title}
      subtitle={review ? "Feedback" : draft.mode === "exam" ? "Exam mode" : "Practice mode"}
      timer={review ? null : secondsLeft != null ? { seconds: secondsLeft, kind: "left" } : elapsed != null ? { seconds: elapsed, kind: "elapsed" } : null}
      actions={
        !review && !mock ? (
          <Link href={exitHref} className={buttonClass("ghost", "px-2.5 py-1.5 text-xs")}>
            Exit
          </Link>
        ) : null
      }
      footer={footer}
    >
      <div className="flex h-full flex-col md:flex-row">
        <section data-scroll className="max-h-[40%] overflow-y-auto border-b border-line bg-raised p-4 md:max-h-none md:w-1/2 md:border-b-0 md:border-r sm:p-6" aria-label={`Writing Task ${task.task} question`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Writing Task {task.task}</p>
          <p className="mt-2 text-sm">You should spend about {task.minutes} minutes on this task.</p>
          <div className="prose-reading mt-4 rounded-xl border border-line bg-surface p-4">
            <p>{task.prompt}</p>
            {task.question && <p className="mt-3 font-semibold">{task.question}</p>}
            {task.task === 2 && (
              <p className="mt-3 text-sm text-ink-soft">Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold">Write at least {task.minWords} words.</p>
          {task.visual && (
            <div className="mt-4 rounded-lg border border-line bg-surface p-4">
              <TaskVisual visual={task.visual} />
            </div>
          )}
        </section>
        <section className="flex min-h-0 flex-1 flex-col" aria-label="Your answer">
          {review ? (
            <div data-scroll className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {timeUp && <Alert tone="info" className="mb-4">Time was up, so your writing was submitted automatically.</Alert>}
              <WritingFeedback taskNumber={task.task} minWords={task.minWords} result={result} answer={answer} />
            </div>
          ) : (
            <>
              <label htmlFor={`answer-${task.id}`} className="sr-only">Your answer to Task {task.task}</label>
              <textarea
                id={`answer-${task.id}`}
                key={task.id}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                disabled={Boolean(pending)}
                placeholder="Type your answer here."
                className="prose-reading min-h-0 w-full flex-1 resize-none border-0 bg-surface px-5 py-4 text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink-faint focus:outline-none"
              />
              <div className="flex items-center justify-between border-t border-line bg-sunken px-4 py-1.5 text-xs">
                <span className="text-ink-faint">Saved on this device</span>
                <span className={`font-semibold tabular-nums ${words >= task.minWords ? "text-good" : "text-ink-soft"}`}>Word count: {words}</span>
              </div>
              {error && (
                <Alert tone="error" className="m-3">
                  {error.message}
                  {error.code === "QUOTA_EXCEEDED" && (
                    <>
                      {" "}
                      <Link href="/billing" className="font-medium underline">Upgrade to Pro for more</Link>
                    </>
                  )}
                </Alert>
              )}
            </>
          )}
        </section>
      </div>
      {confirm && (
        <Modal
          title="Submit your writing?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>Keep writing</Button>
              <Button onClick={() => void submit()} disabled={scoringNeeded > remainingEvaluations}>Submit</Button>
            </>
          }
        >
          {tasks.map((t) => (
            <span key={t.id} className="block">
              Task {t.task}: {countWords(draft.answers[t.id] ?? "")} words{countWords(draft.answers[t.id] ?? "") < t.minWords ? ` (below ${t.minWords})` : ""}
            </span>
          ))}
          <span className="mt-2 block">
            {scoringNeeded > remainingEvaluations
              ? `You need ${scoringNeeded} evaluations but have ${remainingEvaluations} left today.`
              : `This uses ${scoringNeeded} AI evaluation${scoringNeeded === 1 ? "" : "s"}. You cannot edit after submitting.`}
          </span>
        </Modal>
      )}
      {pending && (
        <Modal title="Scoring your writing" actions={null}>
          The examiner is reading Task {tasks.find((t) => t.id === pending)?.task}. This can take up to a minute.
        </Modal>
      )}
    </CbtShell>
  );
}

export function WritingFeedback({
  taskNumber,
  minWords,
  result,
  answer,
}: {
  taskNumber: 1 | 2;
  minWords: number;
  result?: WritingResult;
  answer?: string;
}) {
  const criterionOne = taskNumber === 1 ? "Task Achievement" : "Task Response";
  if (!result?.evaluation) {
    return <Alert tone="warning">{result?.skipped ?? "This task was not scored."}</Alert>;
  }
  const evaluation = result.evaluation;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Task {taskNumber} feedback</h2>
        <BandBadge score={evaluation.bandScore} size="lg" />
      </div>
      {evaluation.underLength && <Alert tone="warning">This answer was under {minWords} words, which lowers the {criterionOne} score.</Alert>}
      <p className="text-sm leading-6 text-ink-soft">{evaluation.summary}</p>
      <CriteriaTable
        rows={[
          { label: criterionOne, score: evaluation.criteria.taskResponse },
          { label: "Coherence and Cohesion", score: evaluation.criteria.coherenceCohesion },
          { label: "Lexical Resource", score: evaluation.criteria.lexicalResource },
          { label: "Grammatical Range and Accuracy", score: evaluation.criteria.grammaticalRange },
        ]}
      />
      <FeedbackLists strengths={evaluation.strengths} improvements={evaluation.improvements} />
      {answer && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Your answer ({evaluation.wordCount} words)</summary>
          <p className="prose-reading mt-2 whitespace-pre-wrap">{answer}</p>
        </details>
      )}
      {result.attemptId && (
        <ButtonLink href={`/history/${result.attemptId}`} variant="secondary">
          Open in history
        </ButtonLink>
      )}
      <p className="text-xs text-ink-faint">AI feedback is a practice estimate, not an official IELTS score.</p>
    </div>
  );
}
