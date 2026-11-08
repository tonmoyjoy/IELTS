"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Alert, BandBadge, Button, Card, inputClass } from "@/components/ui";
import type { Question, QuestionGroup } from "@/content/types";

type QuestionResult = {
  id: string;
  number: number;
  given: string;
  correct: boolean;
  expected: string;
  explanation: string;
  overWordLimit?: boolean;
};

type SubmitResponse = {
  attempt: { id: string };
  grade: { rawScore: number; totalQuestions: number; band: number; results: QuestionResult[] };
  transcript?: Array<{ speaker: string; text: string }>;
};

type Props = {
  module: "reading" | "listening";
  setId: string;
  groups: QuestionGroup[];
  /** Rendered beside (reading) or above (listening) the questions. */
  aside?: ReactNode;
  layout: "split" | "stacked";
};

function storageKey(module: string, setId: string) {
  return `ielts:draft:${module}:${setId}`;
}

function loadDraft(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveDraft(key: string, answers: Record<string, string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    // storage unavailable (private mode): drafts are a convenience only
  }
}

function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function PromptWithBlank({ prompt }: { prompt: string }) {
  const parts = prompt.split("____");
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && <span className="mx-1 inline-block min-w-10 border-b-2 border-ink-faint align-baseline" aria-hidden />}
        </span>
      ))}
    </>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const labelId = `${question.id}-label`;
  if (question.kind === "choice") {
    return (
      <fieldset aria-labelledby={labelId} className="mt-2 grid gap-1.5" disabled={disabled}>
        {question.options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              value === option.value
                ? "border-accent bg-accent-soft"
                : "border-line hover:bg-sunken"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className=""
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  return (
    <input
      aria-labelledby={labelId}
      value={value}
      disabled={disabled}
      autoComplete="off"
      spellCheck={false}
      maxLength={60}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} max-w-xs`}
      placeholder={question.maxWords === 1 ? "One word" : `Up to ${question.maxWords} words`}
    />
  );
}

export function QuestionSetRunner({ module, setId, groups, aside, layout }: Props) {
  const key = storageKey(module, setId);
  const questions = useMemo(() => groups.flatMap((group) => group.questions), [groups]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);

  useEffect(() => {
    // Restore an unsent draft after the first client render (localStorage is browser-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a browser-only draft after hydration
    setAnswers(loadDraft(key));
  }, [key]);

  const answered = questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const resultById = useMemo(() => new Map(result?.grade.results.map((r) => [r.id, r]) ?? []), [result]);

  function update(id: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      saveDraft(key, next);
      return next;
    });
  }

  async function submit(force = false) {
    setError(null);
    if (!force && answered < questions.length) {
      setConfirmIncomplete(true);
      return;
    }
    setConfirmIncomplete(false);
    setPending(true);
    const res = await apiFetch<SubmitResponse>("/api/practice/attempts", { body: { module, setId, answers } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    clearDraft(key);
    setResult(res.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setResult(null);
    setConfirmIncomplete(false);
    setAnswers({});
    clearDraft(key);
  }

  const questionPanel = (
    <div className="space-y-6">
      {result && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Your score</p>
              <p className="text-3xl font-semibold tabular-nums">
                {result.grade.rawScore} / {result.grade.totalQuestions}
              </p>
            </div>
            <BandBadge score={result.grade.band} size="lg" />
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Estimated band: your raw score is scaled to the 40-question IELTS conversion table.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reset}>Try again</Button>
            <Link href={`/history/${result.attempt.id}`} className="inline-flex items-center px-2 text-sm font-medium text-accent-text hover:underline">
              Saved to history
            </Link>
          </div>
        </Card>
      )}

      {groups.map((group) => (
        <section key={group.range} aria-label={group.range}>
          <h3 className="text-sm font-semibold text-ink">{group.range}</h3>
          <p className="mt-1 text-sm text-ink-soft">{group.instructions}</p>
          <ol className="mt-4 space-y-5">
            {group.questions.map((question) => {
              const graded = resultById.get(question.id);
              return (
                <li key={question.id} className="text-sm">
                  <p id={`${question.id}-label`} className="font-medium text-ink">
                    <span className="mr-2 tabular-nums text-ink-faint">{question.number}.</span>
                    <PromptWithBlank prompt={question.prompt} />
                  </p>
                  <QuestionInput question={question} value={answers[question.id] ?? ""} onChange={(v) => update(question.id, v)} disabled={Boolean(result)} />
                  {graded && (
                    <div className={`mt-2 rounded-md px-3 py-2 text-xs ${graded.correct ? "bg-accent-soft text-good" : "bg-bad-soft text-bad"}`}>
                      <p className="font-semibold">
                        {graded.correct ? "Correct" : `Incorrect${graded.given ? "" : " (no answer)"} — answer: ${graded.expected}`}
                        {graded.overWordLimit ? " · over the word limit" : ""}
                      </p>
                      <p className="mt-0.5">{graded.explanation}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {error && <Alert tone="error">{error}</Alert>}
      {!result && confirmIncomplete && (
        <Alert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              You have answered {answered} of {questions.length} questions. Unanswered questions are marked wrong.
            </span>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmIncomplete(false)}>Keep working</Button>
              <Button onClick={() => void submit(true)} disabled={pending}>Submit anyway</Button>
            </span>
          </div>
        </Alert>
      )}
      {!result && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-ink-faint">{answered} of {questions.length} answered · drafts are saved on this device</p>
          <Button onClick={() => void submit()} disabled={pending}>{pending ? "Marking…" : "Submit answers"}</Button>
        </div>
      )}

      {result?.transcript && result.transcript.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold">Transcript</h3>
          <div className="prose-reading mt-3 space-y-3">
            {result.transcript.map((line, index) => (
              <p key={index}>
                <span className="mr-2 font-semibold text-ink-faint">{line.speaker}:</span>
                {line.text}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  if (layout === "split") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">{aside}</div>
        <Card className="p-6">{questionPanel}</Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {aside}
      <Card className="p-6">{questionPanel}</Card>
    </div>
  );
}
