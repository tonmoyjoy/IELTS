"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ComfortMenu } from "@/components/app/ComfortMenu";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/text";
import { useLockBodyScroll } from "@/components/cbt/hooks";

/**
 * Full-screen frame that mirrors the computer-delivered IELTS layout:
 * a slim header with the timer, the work area, and a question navigator.
 */
export function CbtShell({
  title,
  subtitle,
  timer,
  actions,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  timer?: { seconds: number | null; kind: "left" | "elapsed" } | null;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useLockBodyScroll(true);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper text-ink" role="region" aria-label={`${title} test`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
        </div>
        {timer && <TimerPill seconds={timer.seconds} kind={timer.kind} />}
        <div className="flex items-center gap-1.5">
          {actions}
          <ComfortMenu />
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && <footer className="border-t border-line bg-surface">{footer}</footer>}
    </div>
  );
}

export function TimerPill({ seconds, kind }: { seconds: number | null; kind: "left" | "elapsed" }) {
  const [hidden, setHidden] = useState(false);
  if (seconds == null) return null;
  const low = kind === "left" && seconds <= 5 * 60;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`rounded-lg px-3 py-1 text-sm font-semibold tabular-nums ${low ? "bg-bad-soft text-bad" : "bg-sunken"}`}
        aria-live={low && seconds % 60 === 0 ? "polite" : "off"}
      >
        {hidden ? (kind === "left" ? "Time hidden" : "") : kind === "left" ? `${formatDuration(seconds)} left` : formatDuration(seconds)}
      </span>
      <button type="button" className="rounded-md px-1.5 py-1 text-xs text-ink-faint hover:bg-sunken" onClick={() => setHidden((v) => !v)}>
        {hidden ? "Show" : "Hide"}
      </button>
    </div>
  );
}

export function Modal({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lift focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-ink-soft">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** First screen of a test: rules and mode choice. */
export function StartScreen({
  title,
  points,
  modes,
  onStart,
  exitHref,
}: {
  title: string;
  points: string[];
  modes?: { exam: string; practice: string };
  onStart: (mode: "exam" | "practice") => void;
  exitHref?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Instructions to candidates</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {modes ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onStart("exam")}
              className="rounded-xl border-2 border-accent bg-accent-soft p-4 text-left transition-colors hover:bg-raised"
            >
              <span className="block font-semibold">Exam mode</span>
              <span className="mt-1 block text-xs text-ink-soft">{modes.exam}</span>
            </button>
            <button type="button" onClick={() => onStart("practice")} className="rounded-xl border border-line-strong p-4 text-left transition-colors hover:bg-sunken">
              <span className="block font-semibold">Practice mode</span>
              <span className="mt-1 block text-xs text-ink-soft">{modes.practice}</span>
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={() => onStart("exam")}>Start test</Button>
          </div>
        )}
        {exitHref && (
          <a href={exitHref} className="mt-5 inline-block text-sm text-ink-faint hover:underline">
            ← Back
          </a>
        )}
      </div>
    </div>
  );
}
