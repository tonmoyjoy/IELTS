"use client";

import Link from "next/link";
import type { SpeakingSet } from "@/content/types";
import { ButtonLink, Card } from "@/components/ui";
import { SpeakingRecorder } from "@/components/practice/SpeakingRecorder";

export function SpeakingStudio({ sets, active, remainingEvaluations }: { sets: SpeakingSet[]; active: SpeakingSet; remainingEvaluations: number }) {
  return (
    <div className="space-y-6">
      <nav aria-label="Speaking topics" className="flex flex-wrap gap-2">
        {sets.map((set) => (
          <Link
            key={set.id}
            href={`/practice/speaking?set=${set.id}`}
            scroll={false}
            aria-current={set.id === active.id ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              set.id === active.id
                ? "bg-accent-btn text-on-accent"
                : "border border-line-strong text-ink-soft hover:bg-sunken"
            }`}
          >
            {set.title}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Part 1 · Interview</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">{active.part1.map((q) => <li key={q}>{q}</li>)}</ul>
        </Card>
        <Card className="border-accent p-5">
          <h2 className="text-sm font-semibold">Part 2 · Cue card</h2>
          <p className="mt-2 text-sm font-medium">{active.part2.cue}</p>
          <p className="mt-2 text-xs text-ink-faint">You should say:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">{active.part2.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Part 3 · Discussion</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">{active.part3.map((q) => <li key={q}>{q}</li>)}</ul>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 border-accent bg-accent-soft p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Recommended</p>
          <h2 className="mt-1 font-semibold">Full test with a talking examiner</h2>
          <p className="mt-1 text-sm text-ink-soft">The examiner asks every question out loud, gives you 1 minute to prepare Part 2, and scores the whole test. About 12 minutes.</p>
        </div>
        <ButtonLink href={`/practice/speaking?set=${active.id}&exam=1`}>Start the test</ButtonLink>
      </Card>

      <div className="max-w-2xl">
        <SpeakingRecorder key={active.id} setId={active.id} remainingEvaluations={remainingEvaluations} />
      </div>
    </div>
  );
}
