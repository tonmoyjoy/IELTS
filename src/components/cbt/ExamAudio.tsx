"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/text";

export type AudioProgress = { part: number; time: number; finished: boolean };

/**
 * Listening audio bar. Exam mode plays every part once, in order, with no
 * pause or seek (only volume), like the real test. Practice mode gives normal
 * controls for each part.
 */
export function ExamAudio({
  parts,
  mode,
  initial,
  onProgress,
  onPartChange,
}: {
  parts: Array<{ src: string; label: string }>;
  mode: "exam" | "practice";
  initial?: AudioProgress | null;
  onProgress?: (progress: AudioProgress) => void;
  onPartChange?: (part: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [part, setPart] = useState(initial?.part ?? 0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(initial?.finished ?? false);
  const [position, setPosition] = useState(initial?.time ?? 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const resumeAt = useRef(initial?.time ?? 0);
  const progressRef = useRef(onProgress);
  const partChangeRef = useRef(onPartChange);

  useEffect(() => {
    progressRef.current = onProgress;
    partChangeRef.current = onPartChange;
  }, [onProgress, onPartChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setPosition(audio.currentTime);
      progressRef.current?.({ part, time: audio.currentTime, finished: false });
    };
    const onMeta = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      if (resumeAt.current > 0 && resumeAt.current < audio.duration) audio.currentTime = resumeAt.current;
      resumeAt.current = 0;
    };
    const onEnd = () => {
      if (mode === "practice") return;
      if (part + 1 < parts.length) {
        setPart(part + 1);
        partChangeRef.current?.(part + 1);
      } else {
        setFinished(true);
        progressRef.current?.({ part, time: audio.currentTime, finished: true });
      }
    };
    const onError = () => setError("The recording could not be loaded. Check your connection and refresh the page.");
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
  }, [part, parts.length, mode]);

  // Moving to the next part in exam mode continues playback automatically.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mode !== "exam" || !started || finished) return;
    audio.play().catch(() => setError("Your browser paused the recording. Press Continue."));
  }, [part, mode, started, finished]);

  async function start() {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    try {
      await audio.play();
      setStarted(true);
    } catch {
      setError("Your browser blocked playback. Press the button again.");
    }
  }

  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="border-b border-line bg-surface px-4 py-3">
      <audio
        ref={audioRef}
        src={parts[part]?.src}
        preload="auto"
        controls={mode === "practice"}
        className={mode === "practice" ? "w-full max-w-xl" : "hidden"}
        aria-label={`${parts[part]?.label} recording`}
      />
      {mode === "practice" && parts.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parts.map((p, index) => (
            <button
              key={p.src}
              type="button"
              onClick={() => {
                setPart(index);
                partChangeRef.current?.(index);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${index === part ? "bg-accent-btn text-on-accent" : "border border-line-strong text-ink-soft"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      {mode === "exam" && (
        <div className="flex flex-wrap items-center gap-3">
          {!started && !finished ? (
            <Button onClick={start}>{position > 0 || part > 0 ? "Continue the recording" : "Start the recording"}</Button>
          ) : (
            <span className="text-sm font-medium">
              {finished ? "Recording finished" : `Playing ${parts[part]?.label}`}
            </span>
          )}
          <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Recording progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(finished ? 100 : progress)}>
            <div className="h-full bg-accent-btn transition-[width]" style={{ width: `${finished ? 100 : progress}%` }} />
          </div>
          <span className="text-xs tabular-nums text-ink-faint">
            {formatDuration(position)} / {formatDuration(duration)}
          </span>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            Volume
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-24" />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
