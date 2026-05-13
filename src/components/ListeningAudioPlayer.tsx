"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ListeningAudioPlayer({ src }: Props) {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAudio() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass();
        contextRef.current = context;
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        bufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);
        setReady(true);
      } catch {
        if (!cancelled) setError("Could not load listening audio.");
      }
    }

    void loadAudio();
    return () => {
      cancelled = true;
      sourceRef.current?.stop();
      void contextRef.current?.close();
    };
  }, [src]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const context = contextRef.current;
      if (!context) return;
      setPosition(Math.min(duration, offsetRef.current + context.currentTime - startedAtRef.current));
    }, 200);
    return () => window.clearInterval(id);
  }, [duration, playing]);

  function stopSource() {
    sourceRef.current?.disconnect();
    try {
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current = null;
  }

  async function play() {
    const context = contextRef.current;
    const buffer = bufferRef.current;
    if (!context || !buffer) return;
    await context.resume();
    stopSource();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (offsetRef.current + context.currentTime - startedAtRef.current >= duration - 0.1) {
        offsetRef.current = 0;
        setPosition(0);
      }
      setPlaying(false);
    };
    startedAtRef.current = context.currentTime;
    source.start(0, offsetRef.current);
    sourceRef.current = source;
    setPlaying(true);
  }

  function pause() {
    const context = contextRef.current;
    if (context) {
      offsetRef.current = Math.min(duration, offsetRef.current + context.currentTime - startedAtRef.current);
      setPosition(offsetRef.current);
    }
    stopSource();
    setPlaying(false);
  }

  function restart() {
    stopSource();
    offsetRef.current = 0;
    setPosition(0);
    setPlaying(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Section 1 audio</p>
          <p className="text-xs text-zinc-500">MP3 decoded and played with the Web Audio API</p>
        </div>
        <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
          {formatTime(position)} / {formatTime(duration)}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-emerald-600"
          style={{ width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%` }}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={!ready}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={restart}
          disabled={!ready}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
        >
          Restart
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
