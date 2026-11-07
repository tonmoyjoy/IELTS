"use client";

import { useEffect, useState } from "react";
import type { SpeakingSet } from "@/content/types";
import { Button, Card } from "@/components/ui";
import { formatDuration } from "@/lib/text";

type Phase = "idle" | "part1" | "prep" | "part2" | "part3" | "done";

const PHASES: Record<Phase, { label: string; seconds: number; next: Phase }> = {
  idle: { label: "Ready", seconds: 0, next: "part1" },
  part1: { label: "Part 1 · Interview", seconds: 4 * 60, next: "prep" },
  prep: { label: "Part 2 · Preparation", seconds: 60, next: "part2" },
  part2: { label: "Part 2 · Long turn", seconds: 2 * 60, next: "part3" },
  part3: { label: "Part 3 · Discussion", seconds: 5 * 60, next: "done" },
  done: { label: "Finished", seconds: 0, next: "idle" },
};

export function TimedSpeaking({ set }: { set: SpeakingSet }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // A different topic set resets the simulation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("idle");
    setRemaining(0);
    setRunning(false);
  }, [set.id]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  function go(target: Phase) {
    setPhase(target);
    setRemaining(PHASES[target].seconds);
    setRunning(target !== "idle" && target !== "done");
  }

  const prompts =
    phase === "part1"
      ? set.part1
      : phase === "prep" || phase === "part2"
        ? [set.part2.cue, ...set.part2.bullets.map((b) => `• ${b}`)]
        : phase === "part3"
          ? set.part3
          : phase === "done"
            ? ["Simulation complete. Record your Part 2 answer below for a scored assessment."]
            : ["A full timed run-through of the Speaking test: about 12 minutes. Answer out loud as if an examiner were asking."];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Timed exam simulation</h2>
          <p className="text-xs text-zinc-500">Part 1 (4 min) → 1 min preparation → Part 2 (2 min) → Part 3 (5 min)</p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-2 text-right dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">{PHASES[phase].label}</p>
          <p className="text-xl font-semibold tabular-nums" aria-live="off">{formatDuration(remaining)}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
        {prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {phase === "idle" || phase === "done" ? (
          <Button onClick={() => go("part1")}>Start simulation</Button>
        ) : (
          <>
            <Button onClick={() => go(PHASES[phase].next)}>Next part</Button>
            <Button variant="secondary" onClick={() => setRunning((v) => !v)}>{running ? "Pause" : "Resume"}</Button>
            <Button variant="ghost" onClick={() => go("idle")}>Stop</Button>
          </>
        )}
      </div>
    </Card>
  );
}
