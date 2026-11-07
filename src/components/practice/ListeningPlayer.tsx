"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/text";

/**
 * Exam mode mirrors the real test: the recording plays once, with no
 * pausing or rewinding. Practice mode exposes normal controls.
 */
export function ListeningPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<"exam" | "practice">("exam");
  const [state, setState] = useState<"ready" | "playing" | "finished">("ready");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => setState("finished");
    const onError = () => setError("The recording could not be loaded. Refresh the page to try again.");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onError);
    };
  }, []);

  async function playOnce() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      await audio.play();
      setState("playing");
    } catch {
      setError("Your browser blocked playback. Press play again.");
    }
  }

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Recording</p>
          <p className="text-xs text-zinc-500">
            {mode === "exam" ? "Exam mode: plays once, like the real test." : "Practice mode: pause and replay freely."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-emerald-600"
            checked={mode === "practice"}
            disabled={state === "playing" && mode === "exam"}
            onChange={(e) => setMode(e.target.checked ? "practice" : "exam")}
          />
          Practice mode
        </label>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" controls={mode === "practice"} className={mode === "practice" ? "mt-4 w-full" : "hidden"} />

      {mode === "exam" && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Playback progress">
            <div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button onClick={playOnce} disabled={state !== "ready"}>
              {state === "ready" ? "Play recording" : state === "playing" ? "Playing…" : "Recording finished"}
            </Button>
            <span className="text-sm tabular-nums text-zinc-500">
              {formatDuration(position)} / {formatDuration(duration)}
            </span>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
