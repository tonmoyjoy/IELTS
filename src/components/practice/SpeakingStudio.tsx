"use client";

import Link from "next/link";
import type { SpeakingSet } from "@/content/types";
import { Card } from "@/components/ui";
import { TimedSpeaking } from "@/components/practice/TimedSpeaking";
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

      <div className="grid gap-6 lg:grid-cols-2">
        <TimedSpeaking set={active} />
        <SpeakingRecorder key={active.id} setId={active.id} remainingEvaluations={remainingEvaluations} />
      </div>
    </div>
  );
}
