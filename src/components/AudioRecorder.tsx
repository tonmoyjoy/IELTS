"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onComplete?: (payload: {
    transcript: string;
    bandScore: number;
    breakdown: Record<string, number>;
    summary?: string;
    elapsedMs: number;
  }) => void;
};

const MIN_RECORDING_SECONDS = 30;
const MAX_RECORDING_SECONDS = 5 * 60;

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

type LegacyNavigator = Navigator & {
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    success: (stream: MediaStream) => void,
    error: (error: DOMException) => void
  ) => void;
  webkitGetUserMedia?: LegacyNavigator["getUserMedia"];
  mozGetUserMedia?: LegacyNavigator["getUserMedia"];
  msGetUserMedia?: LegacyNavigator["getUserMedia"];
};

function isLocalhost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function localhostUrl() {
  return `http://localhost:${window.location.port || "3000"}${window.location.pathname}${window.location.search}`;
}

function microphoneAccessHint() {
  if (window.location.protocol === "https:") {
    return " Allow microphone access in the browser site settings, then try again.";
  }

  if (window.location.protocol === "http:" && !isLocalhost()) {
    return ` Use your HTTPS Vercel URL in production. For local testing, open ${localhostUrl()} instead because browsers block microphones on non-local HTTP addresses.`;
  }

  return " Use the latest Chrome/Edge on localhost or an HTTPS deployment.";
}

async function requestMicrophoneStream(): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  const legacyNavigator = navigator as LegacyNavigator;
  const legacyGetUserMedia =
    legacyNavigator.getUserMedia ??
    legacyNavigator.webkitGetUserMedia ??
    legacyNavigator.mozGetUserMedia ??
    legacyNavigator.msGetUserMedia;

  if (legacyGetUserMedia) {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(legacyNavigator, { audio: true }, resolve, reject);
    });
  }

  throw new Error("MICROPHONE_API_UNAVAILABLE");
}

type SsePayload =
  | { type: "transcript"; transcript: string }
  | { type: "eval_delta"; text: string }
  | {
      type: "result";
      transcript: string;
      bandScore: number;
      breakdown: Record<string, number>;
      summary?: string;
      testId: string;
      elapsedMs: number;
    }
  | { type: "error"; message: string };

async function consumeExamSse(
  res: Response,
  handlers: {
    onTranscript: (t: string) => void;
    onEvalDelta: (t: string) => void;
    onResult: (p: Extract<SsePayload, { type: "result" }>) => void;
    onError: (m: string) => void;
  }
) {
  const reader = res.body?.getReader();
  if (!reader) {
    handlers.onError("No response body");
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json) continue;
        let payload: SsePayload;
        try {
          payload = JSON.parse(json) as SsePayload;
        } catch {
          continue;
        }
        if (payload.type === "transcript") {
          handlers.onTranscript(payload.transcript);
        } else if (payload.type === "eval_delta") {
          handlers.onEvalDelta(payload.text);
        } else if (payload.type === "result") {
          handlers.onResult(payload);
        } else if (payload.type === "error") {
          handlers.onError(payload.message);
        }
      }
    }
  }
}

export function AudioRecorder({ onComplete }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Record a short speaking answer to begin.");
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);
  const [evalStreamPreview, setEvalStreamPreview] = useState("");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const recordingStartedAtRef = useRef<number | null>(null);
  const evalPreviewMax = 2000;

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const buildRecordedBlob = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    const seconds = recordingStartedAtRef.current
      ? Math.max(1, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
      : 0;
    setRecordedBlob(blob);
    setRecordedSeconds(seconds);
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    return blob;
  }, []);

  const stop = useCallback(() => {
    const mr = mediaRef.current;
    if (mr && mr.state !== "inactive") {
      mr.addEventListener(
        "stop",
        () => {
          buildRecordedBlob();
          setStatus("Recording saved. Review it, then submit for scoring.");
        },
        { once: true }
      );
      mr.stop();
    } else {
      buildRecordedBlob();
      setStatus("Recording saved. Review it, then submit for scoring.");
    }
    mediaRef.current = null;
    setRecording(false);
  }, [buildRecordedBlob]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      if (recordingStartedAtRef.current) {
        const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stop();
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [recording, stop]);

  const start = useCallback(async () => {
    setError(null);
    setUploadedFileName(null);
    setStatus("Requesting microphone access...");
    setLiveTranscript(null);
    setEvalStreamPreview("");
    setRecordedBlob(null);
    setRecordedSeconds(0);
    setRecordingSeconds(0);
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    chunksRef.current = [];
    try {
      const stream = await requestMicrophoneStream();
      const mimeType = pickMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mimeRef.current = mr.mimeType || "audio/webm";
      mediaRef.current = mr;

      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      recordingStartedAtRef.current = Date.now();
      mr.start(250);
      setRecording(true);
      setStatus("Recording... speak clearly for at least 30 seconds. Maximum length is 5 minutes.");
    } catch (e) {
      setStatus("Microphone access failed.");
      if (e instanceof Error && e.message === "MICROPHONE_API_UNAVAILABLE") {
        setError(`This browser page cannot access the microphone.${microphoneAccessHint()}`);
        return;
      }
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser, then try again."
          : "Could not start recording. Check your microphone and browser permissions."
      );
    }
  }, []);

  const uploadAudio = useCallback((file: File | null) => {
    setError(null);
    setLiveTranscript(null);
    setEvalStreamPreview("");

    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please upload an audio file such as MP3, M4A, WAV, OGG, or WebM.");
      return;
    }

    setRecordedBlob(file);
    setUploadedFileName(file.name);
    mimeRef.current = file.type || "audio/mpeg";
    setRecordedSeconds(MIN_RECORDING_SECONDS);
    setRecordingSeconds(0);
    setStatus("Audio file selected. Submit it for Gemini transcription and IELTS scoring.");
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    const mr = mediaRef.current;
    let blob = recordedBlob;
    if (mr && mr.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mr.addEventListener("stop", () => resolve(), { once: true });
        mr.stop();
      });
      blob = buildRecordedBlob();
    }
    setRecording(false);

    if (!blob || blob.size < 100) {
      setStatus("Record a short speaking answer to begin.");
      setError("No usable recording found. Record at least 30 seconds, then submit again.");
      return;
    }

    if (recordedSeconds < MIN_RECORDING_SECONDS) {
      setStatus("Recording is too short.");
      setError("Please record at least 30 seconds before submitting, or upload a prepared speaking audio file.");
      return;
    }

    if (recordedSeconds > MAX_RECORDING_SECONDS) {
      setStatus("Recording is too long.");
      setError("Please keep your answer under 5 minutes.");
      return;
    }

    setBusy(true);
    setError(null);
    setLiveTranscript(null);
    setEvalStreamPreview("");
    setStatus("Uploading audio to Gemini for transcription...");

    const form = new FormData();
    const ext = mimeRef.current.includes("ogg")
      ? "ogg"
      : mimeRef.current.includes("mp4") || mimeRef.current.includes("aac")
        ? "m4a"
        : "webm";
    form.append("audio", blob, `speech.${ext}`);
    form.append("durationSeconds", String(recordedSeconds));

    try {
      const res = await fetch("/api/exam/analyze?stream=1", {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Request failed");
        setStatus("Scoring could not start.");
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        setError("Unexpected response from server");
        setStatus("The server returned an unexpected response.");
        return;
      }

      let sawResult = false;
      let streamFailed = false;

      await consumeExamSse(res, {
        onTranscript: (t) => {
          setLiveTranscript(t);
          setStatus("Transcript ready. Gemini is scoring your answer...");
        },
        onEvalDelta: (text) => {
          setEvalStreamPreview((prev) => (prev + text).slice(-evalPreviewMax));
        },
        onResult: (p) => {
          sawResult = true;
          setLastMs(p.elapsedMs);
          setLiveTranscript(p.transcript);
          setEvalStreamPreview("");
          setStatus("Scoring complete.");
          onComplete?.({
            transcript: p.transcript,
            bandScore: p.bandScore,
            breakdown: p.breakdown,
            summary: p.summary,
            elapsedMs: p.elapsedMs,
          });
        },
        onError: (m) => {
          streamFailed = true;
          setError(m);
          setStatus("Scoring failed.");
        },
      });

      if (!sawResult && !streamFailed) {
        setError("Connection closed before scores were ready");
        setStatus("Connection closed early.");
      }
    } catch {
      setError("Network error");
      setStatus("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }, [buildRecordedBlob, onComplete, recordedBlob, recordedSeconds]);

  const busyLabel = liveTranscript == null ? "Transcribing…" : "Streaming evaluation…";
  const displaySeconds = recording ? recordingSeconds : recordedSeconds;
  const canSubmit = Boolean(recordedBlob) && recordedSeconds >= MIN_RECORDING_SECONDS && recordedSeconds <= MAX_RECORDING_SECONDS;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Speaking sample</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Record a clear answer between 30 seconds and 5 minutes. Gemini transcribes it, then scores
            your IELTS response.
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-right text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <p className="font-medium">
            {Math.floor(displaySeconds / 60)}:{String(displaySeconds % 60).padStart(2, "0")}
          </p>
          <p>{mimeRef.current.split(";")[0] || "audio/webm"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        {status}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Start recording
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || recording || !canSubmit}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {busy ? busyLabel : "Submit for scoring"}
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <label htmlFor="speaking-audio-upload" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Microphone not working?
        </label>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload an existing speaking audio file instead. This helps on browsers or deployed previews where microphone
          access is blocked.
        </p>
        <input
          id="speaking-audio-upload"
          type="file"
          accept="audio/*"
          disabled={busy || recording}
          onChange={(e) => uploadAudio(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
        {uploadedFileName && <p className="mt-2 text-xs text-zinc-500">Selected: {uploadedFileName}</p>}
      </div>

      {recordedBlob && !canSubmit && !busy && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          {recordedSeconds < MIN_RECORDING_SECONDS
            ? `Record ${MIN_RECORDING_SECONDS - recordedSeconds} more seconds before submitting.`
            : "This recording is over 5 minutes. Please record a shorter answer."}
        </p>
      )}

      {audioUrl && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Review recording</p>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      {liveTranscript != null && (
        <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Transcript</p>
          <p className="mt-1 text-zinc-800 dark:text-zinc-200">{liveTranscript}</p>
        </div>
      )}
      {busy && evalStreamPreview.length > 0 && (
        <pre className="mt-3 max-h-24 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {evalStreamPreview}
        </pre>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}
      {lastMs != null && (
        <p className="mt-2 text-xs text-zinc-500">Last server round-trip (ASR + AI): {lastMs} ms</p>
      )}
    </div>
  );
}
