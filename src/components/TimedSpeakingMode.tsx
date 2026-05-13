"use client";

import { useEffect, useMemo, useState } from "react";
import { speakingPrompts } from "@/lib/ielts/practice-data";

type Phase = "idle" | "part1" | "prep" | "part2" | "part3" | "done";

const phaseMeta: Record<Phase, { label: string; seconds: number }> = {
  idle: { label: "Ready", seconds: 0 },
  part1: { label: "Part 1 interview", seconds: 4 * 60 },
  prep: { label: "Part 2 preparation", seconds: 60 },
  part2: { label: "Part 2 long turn", seconds: 2 * 60 },
  part3: { label: "Part 3 discussion", seconds: 5 * 60 },
  done: { label: "Complete", seconds: 0 },
};

const nextPhase: Record<Phase, Phase> = {
  idle: "part1",
  part1: "prep",
  prep: "part2",
  part2: "part3",
  part3: "done",
  done: "idle",
};

function format(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TimedSpeakingMode() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);

  const prompts = useMemo(() => {
    if (phase === "part1") return speakingPrompts.part1;
    if (phase === "prep" || phase === "part2") {
      return [speakingPrompts.part2.cue, ...speakingPrompts.part2.bullets];
    }
    if (phase === "part3") return speakingPrompts.part3;
    return ["Start a timed IELTS speaking simulation."];
  }, [phase]);

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

  function startPhase(target: Phase) {
    setPhase(target);
    setRemaining(phaseMeta[target].seconds);
    setRunning(target !== "idle" && target !== "done");
  }

  function advance() {
    startPhase(nextPhase[phase]);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Timed speaking exam mode</p>
          <p className="text-xs text-zinc-500">Part 1, one-minute prep, two-minute cue card, Part 3</p>
        </div>
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-right dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">{phaseMeta[phase].label}</p>
          <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {format(remaining)}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        {prompts.map((prompt) => (
          <li key={prompt}>{prompt}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startPhase(phase === "idle" || phase === "done" ? "part1" : phase)}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
        >
          {phase === "idle" || phase === "done" ? "Start exam" : "Restart phase"}
        </button>
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          disabled={phase === "idle" || phase === "done"}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
        >
          {running ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={advance}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
        >
          Next phase
        </button>
      </div>
    </div>
  );
}
