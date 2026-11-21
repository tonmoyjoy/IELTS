"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { rawToBand } from "@/lib/bands";
import { Alert, BandBadge, Button, buttonClass } from "@/components/ui";
import type { Question, QuestionGroup, ReadingSet } from "@/content/types";
import { CbtShell, Modal, StartScreen } from "@/components/cbt/CbtShell";
import { HighlightArea, MarkedText, type Highlights } from "@/components/cbt/Highlighter";
import { ExamAudio, type AudioProgress } from "@/components/cbt/ExamAudio";
import { loadJson, removeKey, saveJson, useCountdown, useElapsed, useLeaveWarning } from "@/components/cbt/hooks";

export type TestPart = {
  setId: string;
  title: string;
  label: string;
  /** Added to each question's number so numbering runs across parts (1–40). */
  offset: number;
  groups: QuestionGroup[];
  passage?: ReadingSet["passage"];
  audioSrc?: string;
};

type QuestionResult = {
  id: string;
  number: number;
  given: string;
  correct: boolean;
  expected: string;
  explanation: string;
  overWordLimit?: boolean;
};

export type PartResult = {
  attempt: { id: string };
  grade: { rawScore: number; totalQuestions: number; band: number; results: QuestionResult[] };
  transcript?: Array<{ speaker: string; text: string }>;
};

type Draft = {
  mode: "exam" | "practice";
  startedAt: number;
  answers: Record<string, string>;
  flags: string[];
  highlights: Highlights;
  audio?: AudioProgress | null;
  checkDeadline?: number | null;
};

const LISTENING_CHECK_SECONDS = 2 * 60;

type Props = {
  module: "reading" | "listening";
  title: string;
  parts: TestPart[];
  /** Exam-mode time limit for reading (seconds). */
  timeLimitSeconds?: number;
  storageKey: string;
  exitHref: string;
  /** Mock test: exam mode only, server-issued deadline, results handled by the caller. */
  mock?: { deadline: number; onSubmitted: (results: PartResult[]) => Promise<void> };
};

export function ObjectiveTest({ module, title, parts, timeLimitSeconds, storageKey, exitHref, mock }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);
  const [currentPart, setCurrentPart] = useState(0);
  const [currentQ, setCurrentQ] = useState<string | null>(null);
  const [results, setResults] = useState<PartResult[] | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, PartResult>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [paneSplit, setPaneSplit] = useState(50);
  const [mobilePane, setMobilePane] = useState<"passage" | "questions">("passage");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAudioSave = useRef(0);

  const allQuestions = useMemo(
    () => parts.flatMap((part, partIndex) => part.groups.flatMap((g) => g.questions.map((q) => ({ q, part: partIndex, number: q.number + part.offset })))),
    [parts]
  );

  useEffect(() => {
    const saved = loadJson<Draft>(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a browser-only draft after hydration
    if (saved && typeof saved.startedAt === "number") setDraft({ ...saved, mode: mock ? "exam" : saved.mode });
    else if (mock) setDraft(newDraft("exam"));
    if (saved?.audio) setCurrentPart(saved.audio.part);
    setRestored(true);
  }, [storageKey, mock]);

  const update = useCallback(
    (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
        saveJson(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const inTest = Boolean(draft) && !results;
  useLeaveWarning(inTest && Object.keys(draft?.answers ?? {}).length > 0);

  const examDeadline = useMemo(() => {
    if (!draft || draft.mode !== "exam" || results) return null;
    if (mock) {
      return module === "listening" && draft.checkDeadline ? Math.min(mock.deadline, draft.checkDeadline) : mock.deadline;
    }
    if (module === "reading" && timeLimitSeconds) return draft.startedAt + timeLimitSeconds * 1000;
    if (module === "listening" && draft.checkDeadline) return draft.checkDeadline;
    return null;
  }, [draft, results, mock, module, timeLimitSeconds]);

  const submitAll = useCallback(async () => {
    if (!draft) return;
    setConfirm(false);
    setPending(true);
    setError(null);
    const done: Record<string, PartResult> = { ...submitted };
    for (const part of parts) {
      if (done[part.setId]) continue;
      const ids = new Set(part.groups.flatMap((g) => g.questions.map((q) => q.id)));
      const answers = Object.fromEntries(Object.entries(draft.answers).filter(([id, value]) => ids.has(id) && value.trim()));
      const res = await apiFetch<PartResult>("/api/practice/attempts", { body: { module, setId: part.setId, answers } });
      if (!res.ok) {
        setSubmitted(done);
        setPending(false);
        setError(`${res.error} Your answers are saved on this device: press Submit again.`);
        return;
      }
      done[part.setId] = res.data;
    }
    setSubmitted(done);
    const ordered = parts.map((part) => done[part.setId]);
    if (mock) {
      try {
        await mock.onSubmitted(ordered);
      } catch (e) {
        setPending(false);
        setError(e instanceof Error ? e.message : "Could not save this section. Press Submit again.");
        return;
      }
    }
    removeKey(storageKey);
    setPending(false);
    setResults(ordered);
    setCurrentPart(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [draft, submitted, parts, module, mock, storageKey]);

  const onExpire = useCallback(() => {
    setTimeUp(true);
    void submitAll();
  }, [submitAll]);
  const secondsLeft = useCountdown(examDeadline, onExpire);
  const elapsed = useElapsed(draft && draft.mode === "practice" && !results ? draft.startedAt : null);

  function newDraft(mode: Draft["mode"]): Draft {
    return { mode, startedAt: Date.now(), answers: {}, flags: [], highlights: {}, audio: null, checkDeadline: null };
  }

  function start(mode: Draft["mode"]) {
    const fresh = newDraft(mode);
    saveJson(storageKey, fresh);
    setDraft(fresh);
  }

  function goTo(id: string) {
    const entry = allQuestions.find((item) => item.q.id === id);
    if (!entry) return;
    setCurrentPart(entry.part);
    setCurrentQ(id);
    setMobilePane("questions");
    window.setTimeout(() => {
      const el = document.getElementById(`q-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    }, 30);
  }

  function step(delta: number) {
    const index = allQuestions.findIndex((item) => item.q.id === currentQ);
    const next = allQuestions[Math.min(allQuestions.length - 1, Math.max(0, (index < 0 ? -1 : index) + delta))];
    if (next) goTo(next.q.id);
  }

  const resultById = useMemo(() => new Map(results?.flatMap((r) => r.grade.results.map((x) => [x.id, x] as const)) ?? []), [results]);

  if (!restored) return null;

  // ----- Start screen -------------------------------------------------------
  if (!draft) {
    const questionsCount = allQuestions.length;
    const points =
      module === "reading"
        ? [
            `${parts.length === 1 ? "One passage" : `${parts.length} passages`}, ${questionsCount} questions.`,
            "The passage is on the left and the questions are on the right. Drag the divider to resize.",
            "Select text in the passage to highlight it. Use the flag to mark questions to review.",
            "Use the numbers at the bottom of the screen to move between questions.",
          ]
        : [
            `${parts.length === 1 ? "One part" : `${parts.length} parts`}, ${questionsCount} questions.`,
            "In exam mode you will hear the recording once only, as in the real test.",
            `When the recording ends you have ${LISTENING_CHECK_SECONDS / 60} minutes to check your answers, then your answers are submitted.`,
            "Use headphones and check the volume before you start.",
          ];
    return (
      <CbtShell title={title}>
        <div className="h-full overflow-y-auto">
          <StartScreen
            title={title}
            points={points}
            exitHref={exitHref}
            onStart={start}
            modes={{
              exam:
                module === "reading"
                  ? `Timed (${Math.round((timeLimitSeconds ?? 1200) / 60)} min) and submitted automatically when time runs out.`
                  : "Recording plays once with no pausing; 2 minutes to check at the end.",
              practice: module === "reading" ? "No time limit. A stopwatch shows how long you take." : "Pause and replay the recording freely.",
            }}
          />
        </div>
      </CbtShell>
    );
  }

  // ----- Test / review --------------------------------------------------------
  const review = Boolean(results);
  const part = parts[currentPart];
  const answeredCount = allQuestions.filter((item) => (draft.answers[item.q.id] ?? "").trim()).length;
  const flagged = new Set(draft.flags);
  const totalRaw = results?.reduce((sum, r) => sum + r.grade.rawScore, 0) ?? 0;
  const totalQs = results?.reduce((sum, r) => sum + r.grade.totalQuestions, 0) ?? 0;

  const timer = review
    ? null
    : secondsLeft != null
      ? { seconds: secondsLeft, kind: "left" as const }
      : elapsed != null
        ? { seconds: elapsed, kind: "elapsed" as const }
        : null;

  const questionsPanel = (
    <div className="space-y-8 p-4 sm:p-6">
      {review && results && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">{timeUp ? "Time is up. Your score" : "Your score"}</p>
              <p className="text-3xl font-semibold tabular-nums">
                {totalRaw} / {totalQs}
              </p>
            </div>
            <BandBadge score={rawToBand(module, totalRaw, totalQs)} size="lg" />
          </div>
          <p className="mt-2 text-xs text-ink-faint">Estimated band, scaled to the 40-question IELTS conversion table. Green and red numbers below show correct and incorrect answers.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!mock && (
              <Button
                variant="secondary"
                onClick={() => {
                  setResults(null);
                  setSubmitted({});
                  setTimeUp(false);
                  setDraft(null);
                }}
              >
                Try again
              </Button>
            )}
            {results.length === 1 && (
              <Link href={`/history/${results[0].attempt.id}`} className={buttonClass("ghost")}>
                Saved to history
              </Link>
            )}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">{part.label}</p>
        <h2 className="mt-0.5 font-semibold">{part.title}</h2>
      </div>
      {part.groups.map((group) => (
        <section key={group.range} aria-label={group.range}>
          <h3 className="text-sm font-semibold">{renumber(group.range, part.offset)}</h3>
          <p className="mt-1 text-sm text-ink-soft">{group.instructions}</p>
          <ol className="mt-4 space-y-4">
            {group.questions.map((question) => (
              <QuestionItem
                key={question.id}
                question={question}
                number={question.number + part.offset}
                value={draft.answers[question.id] ?? ""}
                flagged={flagged.has(question.id)}
                active={currentQ === question.id}
                result={resultById.get(question.id)}
                disabled={review || pending}
                onFocus={() => setCurrentQ(question.id)}
                onChange={(value) => update((d) => ({ answers: { ...d.answers, [question.id]: value } }))}
                onFlag={() =>
                  update((d) => ({ flags: d.flags.includes(question.id) ? d.flags.filter((f) => f !== question.id) : [...d.flags, question.id] }))
                }
              />
            ))}
          </ol>
        </section>
      ))}
      {review && results?.[currentPart]?.transcript?.length ? (
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">Transcript</summary>
          <div className="prose-reading mt-3 space-y-2">
            {results[currentPart].transcript!.map((line, index) => (
              <p key={index}>
                <span className="mr-2 font-sans text-sm font-semibold text-ink-faint">{line.speaker}:</span>
                {line.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );

  const passagePanel = part.passage ? (
    <div className="p-4 sm:p-8">
      <HighlightArea highlights={draft.highlights} onChange={(highlights) => update({ highlights })}>
        <h2 className="font-serif text-xl font-semibold">
          <span data-hl={`${part.setId}:h`}>
            <MarkedText text={part.passage.heading} ranges={draft.highlights[`${part.setId}:h`]} />
          </span>
        </h2>
        <div className="prose-reading mt-5 space-y-5">
          {part.passage.paragraphs.map((paragraph, index) => (
            <p key={paragraph.label}>
              <span className="mr-2 select-none font-sans text-sm font-bold text-accent-text">{paragraph.label}</span>
              <span data-hl={`${part.setId}:${index}`}>
                <MarkedText text={paragraph.text} ranges={draft.highlights[`${part.setId}:${index}`]} />
              </span>
            </p>
          ))}
        </div>
      </HighlightArea>
      <p className="mt-6 text-xs text-ink-faint">Tip: select words to highlight them. Select a highlight again to clear it.</p>
    </div>
  ) : null;

  const footer = (
    <div className="flex items-center gap-2 px-2 py-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
        {parts.map((p, partIndex) => (
          <div key={p.setId} className={`flex shrink-0 items-center gap-1 ${partIndex === currentPart ? "" : "max-sm:hidden"}`}>
            <button
              type="button"
              onClick={() => setCurrentPart(partIndex)}
              className={`mr-1 rounded-md px-2 py-1 text-xs font-semibold ${partIndex === currentPart ? "bg-accent-soft text-accent-text" : "text-ink-soft hover:bg-sunken"}`}
            >
              {p.label}
            </button>
            {allQuestions
              .filter((item) => item.part === partIndex)
              .map(({ q, number }) => {
                const r = resultById.get(q.id);
                const answered = (draft.answers[q.id] ?? "").trim().length > 0;
                const tone = r
                  ? r.correct
                    ? "border-good bg-good-soft text-good"
                    : "border-bad bg-bad-soft text-bad"
                  : answered
                    ? "border-accent-btn bg-accent-btn text-on-accent"
                    : "border-line-strong text-ink-soft";
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goTo(q.id)}
                    aria-label={`Question ${number}${answered ? ", answered" : ""}${flagged.has(q.id) ? ", flagged" : ""}`}
                    className={`relative h-7 w-7 shrink-0 rounded-md border text-xs font-semibold tabular-nums ${tone} ${currentQ === q.id ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                  >
                    {number}
                    {flagged.has(q.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-warn" aria-hidden />}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" className="px-2.5" onClick={() => step(-1)} aria-label="Previous question">←</Button>
        <Button variant="ghost" className="px-2.5" onClick={() => step(1)} aria-label="Next question">→</Button>
        {review ? (
          <Link href={exitHref} className={buttonClass("primary")}>
            {mock ? "Continue" : "Finish"}
          </Link>
        ) : (
          <Button onClick={() => setConfirm(true)} disabled={pending}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </div>
  );

  const audioBar =
    module === "listening" && !review ? (
      <ExamAudio
        parts={parts.map((p) => ({ src: p.audioSrc ?? "", label: p.label }))}
        mode={draft.mode}
        initial={draft.audio}
        onPartChange={(index) => setCurrentPart(index)}
        onProgress={(progress) => {
          if (progress.finished) {
            update((d) => (d.checkDeadline ? { audio: progress } : { audio: progress, checkDeadline: Date.now() + LISTENING_CHECK_SECONDS * 1000 }));
          } else if (Date.now() - lastAudioSave.current > 3000) {
            lastAudioSave.current = Date.now();
            update({ audio: progress });
          }
        }}
      />
    ) : null;

  return (
    <CbtShell
      title={title}
      subtitle={`${draft.mode === "exam" ? "Exam mode" : review ? "Review" : "Practice mode"} · ${answeredCount}/${allQuestions.length} answered${draft.checkDeadline && !review ? " · check your answers" : ""}`}
      timer={timer}
      actions={
        !review && !mock ? (
          <Link href={exitHref} className={buttonClass("ghost", "px-2.5 py-1.5 text-xs")}>
            Exit
          </Link>
        ) : null
      }
      footer={footer}
    >
      <div className="flex h-full flex-col">
        {audioBar}
        {passagePanel ? (
          <>
            <div className="flex border-b border-line md:hidden">
              {(["passage", "questions"] as const).map((pane) => (
                <button
                  key={pane}
                  type="button"
                  onClick={() => setMobilePane(pane)}
                  className={`flex-1 py-2 text-sm font-medium capitalize ${mobilePane === pane ? "border-b-2 border-accent text-accent-text" : "text-ink-soft"}`}
                >
                  {pane}
                </button>
              ))}
            </div>
            <SplitPanes
              split={paneSplit}
              onSplit={setPaneSplit}
              mobilePane={mobilePane}
              left={passagePanel}
              rightRef={scrollRef}
              right={questionsPanel}
            />
          </>
        ) : (
          <div ref={scrollRef} data-scroll className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl">{questionsPanel}</div>
          </div>
        )}
      </div>
      {confirm && (
        <Modal
          title="Submit your answers?"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)}>Keep working</Button>
              <Button onClick={() => void submitAll()}>Submit</Button>
            </>
          }
        >
          You have answered {answeredCount} of {allQuestions.length} questions
          {flagged.size > 0 ? ` and flagged ${flagged.size} for review` : ""}. Unanswered questions are marked wrong. You cannot change your answers after submitting.
        </Modal>
      )}
      {pending && timeUp && (
        <Modal title="Time is up" actions={null}>
          Your answers are being submitted…
        </Modal>
      )}
    </CbtShell>
  );
}

function renumber(range: string, offset: number) {
  if (!offset) return range;
  return range.replace(/\d+/g, (n) => String(Number(n) + offset));
}

function SplitPanes({
  split,
  onSplit,
  mobilePane,
  left,
  right,
  rightRef,
}: {
  rightRef: RefObject<HTMLDivElement | null>;
  split: number;
  onSplit: (value: number) => void;
  mobilePane: "passage" | "questions";
  left: ReactNode;
  right: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  function startDrag(event: ReactPointerEvent) {
    const container = containerRef.current;
    if (!container) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = container.getBoundingClientRect();
    const move = (e: PointerEvent) => onSplit(Math.min(75, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <div ref={containerRef} className="flex min-h-0 flex-1" style={{ ["--split" as string]: `${split}%` }}>
      <div data-scroll className={`min-h-0 overflow-y-auto bg-raised md:block md:w-[var(--split)] ${mobilePane === "passage" ? "w-full" : "hidden"}`}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize passage and questions"
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onSplit(Math.max(25, split - 5));
          if (e.key === "ArrowRight") onSplit(Math.min(75, split + 5));
        }}
        className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-x border-line bg-sunken md:flex"
      >
        <span className="h-8 w-0.5 rounded-full bg-line-strong" aria-hidden />
      </div>
      <div ref={rightRef} data-scroll className={`min-h-0 flex-1 overflow-y-auto md:block ${mobilePane === "questions" ? "block" : "hidden"}`}>
        {right}
      </div>
    </div>
  );
}

function QuestionItem({
  question,
  number,
  value,
  flagged,
  active,
  result,
  disabled,
  onChange,
  onFlag,
  onFocus,
}: {
  question: Question;
  number: number;
  value: string;
  flagged: boolean;
  active: boolean;
  result?: QuestionResult;
  disabled: boolean;
  onChange: (value: string) => void;
  onFlag: () => void;
  onFocus: () => void;
}) {
  const labelId = `${question.id}-label`;
  return (
    <li
      id={`q-${question.id}`}
      onFocus={onFocus}
      className={`rounded-xl border p-3 text-sm transition-colors ${active ? "border-accent bg-surface" : "border-transparent"}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line-strong px-1 text-xs font-semibold tabular-nums">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          {question.kind === "text" ? (
            <p id={labelId} className="leading-8">
              {question.prompt.split("____").map((piece, index, pieces) => (
                <span key={index}>
                  {piece}
                  {index < pieces.length - 1 && (
                    <input
                      aria-label={`Question ${number}: ${question.prompt.replace("____", "blank")}`}
                      value={value}
                      disabled={disabled}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={60}
                      onChange={(e) => onChange(e.target.value)}
                      className="mx-1 w-40 rounded-md border border-line-strong bg-raised px-2 py-0.5 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-80"
                    />
                  )}
                </span>
              ))}
            </p>
          ) : (
            <>
              <p id={labelId} className="font-medium">{question.prompt}</p>
              <fieldset aria-labelledby={labelId} className="mt-2 grid gap-1.5" disabled={disabled}>
                {question.options.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 ${value === option.value ? "border-accent bg-accent-soft" : "border-line hover:bg-sunken"}`}
                  >
                    <input type="radio" name={question.id} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {question.kind === "text" && !result && (
            <p className="mt-1 text-xs text-ink-faint">{question.maxWords === 1 ? "One word" : `No more than ${question.maxWords} words`}{question.allowNumber ? " and/or a number" : ""}</p>
          )}
          {result && (
            <div className={`mt-2 rounded-md px-3 py-2 text-xs ${result.correct ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
              <p className="font-semibold">
                {result.correct ? "Correct" : `Incorrect${result.given ? "" : " (no answer)"} — answer: ${result.expected}`}
                {result.overWordLimit ? " · over the word limit" : ""}
              </p>
              <p className="mt-0.5">{result.explanation}</p>
            </div>
          )}
        </div>
        {!result && (
          <button
            type="button"
            onClick={onFlag}
            aria-pressed={flagged}
            aria-label={flagged ? `Remove flag from question ${number}` : `Flag question ${number} for review`}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${flagged ? "bg-warn-soft text-warn" : "text-ink-faint hover:bg-sunken"}`}
          >
            {flagged ? "⚑ Flagged" : "⚐ Flag"}
          </button>
        )}
      </div>
    </li>
  );
}
