"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readSse } from "@/lib/sse";
import { formatDuration } from "@/lib/text";
import { Alert, BandBadge, Button, ButtonLink, Card } from "@/components/ui";
import { CriteriaTable, FeedbackLists } from "@/components/practice/CriteriaTable";

const MIN_SECONDS = 30;
const MAX_SECONDS = 5 * 60;
const MAX_BYTES = 10 * 1024 * 1024;

type Evaluation = {
  bandScore: number;
  criteria: { fluencyCoherence: number; lexicalResource: number; grammaticalRange: number; pronunciation: number };
  transcript: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

type ResultPayload = { evaluation: Evaluation; attempt: { id: string } };

type Status =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "ready" }
  | { kind: "uploading" }
  | { kind: "scoring" }
  | { kind: "done"; result: ResultPayload }
  | { kind: "error"; message: string };

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
}

function microphoneHint(): string {
  if (!window.isSecureContext) {
    return "Microphone access needs a secure page (https:// or http://localhost).";
  }
  return "Allow microphone access in your browser's site settings, then try again.";
}

/** Reads a local file's duration; returns null when the browser cannot tell (common for WebM). */
function readFileDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}

export function SpeakingRecorder({ setId, remainingEvaluations }: { setId: string; remainingEvaluations: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [durationKnown, setDurationKnown] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const setRecording = useCallback((next: Blob, duration: number | null) => {
    setBlob(next);
    setSeconds(duration == null ? 0 : Math.round(duration));
    setDurationKnown(duration != null);
    setPreviewUrl(URL.createObjectURL(next));
    setStatus({ kind: "ready" });
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  useEffect(() => {
    if (status.kind !== "recording") return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop();
    }, 250);
    return () => window.clearInterval(id);
  }, [status.kind, stop]);

  async function start() {
    setBlob(null);
    setPreviewUrl(null);
    setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({ kind: "error", message: `This browser cannot record audio here. ${microphoneHint()}` });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = (Date.now() - startedRef.current) / 1000;
        setRecording(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }), duration);
      };
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      recorder.start(1000);
      setStatus({ kind: "recording" });
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setStatus({
        kind: "error",
        message: denied ? `Microphone permission was denied. ${microphoneHint()}` : "Could not start recording. Check that a microphone is connected.",
      });
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("audio/") && file.type !== "video/webm") {
      setStatus({ kind: "error", message: "Choose an audio file (MP3, M4A, WAV, OGG or WebM)." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ kind: "error", message: "That file is larger than 10 MB. Trim it to under 5 minutes." });
      return;
    }
    setRecording(file, await readFileDuration(file));
  }

  async function submit() {
    if (!blob) return;
    setStatus({ kind: "uploading" });
    const form = new FormData();
    const type = blob.type || "audio/webm";
    const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : "webm";
    form.append("audio", blob, blob instanceof File ? blob.name : `answer.${ext}`);
    form.append("setId", setId);

    let res: Response;
    try {
      res = await fetch("/api/speaking/evaluate", {
        method: "POST",
        body: form,
        headers: { Accept: "text/event-stream" },
        credentials: "same-origin",
      });
    } catch {
      setStatus({ kind: "error", message: "Network error. Check your connection and try again." });
      return;
    }

    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: body?.error ?? "Scoring could not start. Please try again." });
      return;
    }

    setStatus({ kind: "scoring" });
    let finished = false;
    try {
      await readSse(res, (event) => {
        if (event.event === "result") {
          finished = true;
          setStatus({ kind: "done", result: event.data as ResultPayload });
          router.refresh();
        } else if (event.event === "error") {
          finished = true;
          const data = event.data as { error?: string };
          setStatus({ kind: "error", message: data.error ?? "Scoring failed. Please try again." });
        }
      });
    } catch {
      // handled below
    }
    if (!finished) setStatus({ kind: "error", message: "The connection closed before scoring finished. Please try again." });
  }

  const busy = status.kind === "uploading" || status.kind === "scoring";
  const tooShort = durationKnown && seconds > 0 && seconds < MIN_SECONDS;
  const tooLong = durationKnown && seconds > MAX_SECONDS;
  const canSubmit = Boolean(blob) && !tooShort && !tooLong && !busy && remainingEvaluations > 0 && status.kind !== "done";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Record your answer</h2>
            <p className="text-xs text-ink-faint">
              Answer the Part 2 cue card (1–2 minutes is ideal) or any of the questions. Between 30 seconds and 5 minutes.
            </p>
          </div>
          <span className={`rounded-lg px-3 py-2 text-lg font-semibold tabular-nums ${status.kind === "recording" ? "bg-bad-soft text-bad" : "bg-sunken"}`}>
            {status.kind === "recording" && <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-bad" aria-hidden />}
            {formatDuration(seconds)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {status.kind === "recording" ? (
            <Button variant="danger" onClick={stop}>Stop recording</Button>
          ) : (
            <Button onClick={start} disabled={busy}>{blob ? "Record again" : "Start recording"}</Button>
          )}
          <Button variant="secondary" onClick={submit} disabled={!canSubmit}>
            {status.kind === "uploading" ? "Uploading…" : status.kind === "scoring" ? "Scoring… (up to a minute)" : "Submit for scoring"}
          </Button>
        </div>

        {previewUrl && status.kind !== "recording" && (
          <audio controls src={previewUrl} className="mt-4 w-full" aria-label="Your recording" />
        )}

        {tooShort && <Alert tone="warning" className="mt-3">Record at least {MIN_SECONDS} seconds — {MIN_SECONDS - seconds} more to go.</Alert>}
        {tooLong && <Alert tone="warning" className="mt-3">This recording is over 5 minutes. Please record a shorter answer.</Alert>}
        {status.kind === "error" && <Alert tone="error" className="mt-3">{status.message}</Alert>}
        {remainingEvaluations === 0 && status.kind !== "done" && (
          <Alert tone="info" className="mt-3">You have used today&apos;s speaking evaluations. They reset at 00:00 UTC. <Link href="/billing" className="font-medium underline">Upgrade to Pro</Link> for more.</Alert>
        )}

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-ink-soft">Microphone not working? Upload a recording instead</summary>
          <label htmlFor="speaking-upload" className="mt-2 block text-xs text-ink-faint">MP3, M4A, WAV, OGG or WebM, up to 10 MB.</label>
          <input
            id="speaking-upload"
            type="file"
            accept="audio/*,video/webm"
            disabled={busy || status.kind === "recording"}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent-btn file:px-3 file:py-2 file:text-sm file:font-medium file:text-on-accent"
          />
        </details>
        <p className="mt-4 text-xs text-ink-faint">
          Your recording is sent to our AI provider for assessment and is not stored by us; the transcript and feedback are saved to your history.
        </p>
      </Card>

      {status.kind === "done" && (
        <Card className="space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Examiner feedback</h2>
            <BandBadge score={status.result.evaluation.bandScore} size="lg" />
          </div>
          <p className="text-sm leading-6 text-ink-soft">{status.result.evaluation.summary}</p>
          <CriteriaTable
            rows={[
              { label: "Fluency and Coherence", score: status.result.evaluation.criteria.fluencyCoherence },
              { label: "Lexical Resource", score: status.result.evaluation.criteria.lexicalResource },
              { label: "Grammatical Range and Accuracy", score: status.result.evaluation.criteria.grammaticalRange },
              { label: "Pronunciation", score: status.result.evaluation.criteria.pronunciation },
            ]}
          />
          <FeedbackLists strengths={status.result.evaluation.strengths} improvements={status.result.evaluation.improvements} />
          <details>
            <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
            <p className="prose-reading mt-2 whitespace-pre-wrap">{status.result.evaluation.transcript}</p>
          </details>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <ButtonLink href={`/history/${status.result.attempt.id}`} variant="secondary">Open in history</ButtonLink>
          </div>
          <p className="text-xs text-ink-faint">AI feedback is a practice estimate, not an official IELTS score.</p>
        </Card>
      )}
    </div>
  );
}
