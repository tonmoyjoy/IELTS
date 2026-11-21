"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpeakingSet } from "@/content/types";
import { cueCardScript, EXAMINER_LINES, type ExaminerLineKey } from "@/content/speaking";
import { formatDuration } from "@/lib/text";
import { microphoneHint, pickRecordingMimeType, submitSpeaking, type SpeakingResultPayload } from "@/lib/speaking-upload";
import { Alert, Button, buttonClass } from "@/components/ui";
import { SpeakingFeedback } from "@/components/practice/SpeakingFeedback";
import { CbtShell } from "@/components/cbt/CbtShell";
import { useLeaveWarning } from "@/components/cbt/hooks";

type Step =
  | { kind: "say"; key: ExaminerLineKey; part: 1 | 2 | 3 }
  | { kind: "ask"; key: string; text: string; part: 1 | 3; seconds: number }
  | { kind: "cue"; part: 2 }
  | { kind: "longTurn"; part: 2 };

const PREP_SECONDS = 60;
const LONG_TURN_SECONDS = 120;
const PART1_ANSWER_SECONDS = 35;
const PART3_ANSWER_SECONDS = 60;

export function buildSteps(set: SpeakingSet): Step[] {
  return [
    { kind: "say", key: "welcome", part: 1 },
    ...set.part1.map((text, i): Step => ({ kind: "ask", key: `p1-${i}`, text, part: 1, seconds: PART1_ANSWER_SECONDS })),
    { kind: "say", key: "part2Intro", part: 2 },
    { kind: "cue", part: 2 },
    { kind: "say", key: "part2Start", part: 2 },
    { kind: "longTurn", part: 2 },
    { kind: "say", key: "part2End", part: 2 },
    { kind: "say", key: "part3Intro", part: 3 },
    ...set.part3.map((text, i): Step => ({ kind: "ask", key: `p3-${i}`, text, part: 3, seconds: PART3_ANSWER_SECONDS })),
    { kind: "say", key: "end", part: 3 },
  ];
}

type Phase = "check" | "running" | "finished" | "uploading" | "scoring" | "done";

type Props = {
  set: SpeakingSet;
  /** URLs of generated examiner clips by key ("welcome", "p1-0"…); missing keys use the browser's voice. */
  clips: Record<string, string>;
  remainingEvaluations: number;
  exitHref: string;
  mock?: { onSubmitted: (result: SpeakingResultPayload) => Promise<void> };
};

/**
 * A talking examiner: questions are spoken (pre-rendered Gemini voice, or the
 * browser's voice as a fallback), the candidate answers out loud, and only
 * the candidate's answers are recorded (recording pauses while the examiner
 * speaks and during Part 2 preparation). The recording is scored as one test.
 */
export function SpeakingExam({ set, clips, remainingEvaluations, exitHref, mock }: Props) {
  const router = useRouter();
  const steps = useMemo(() => buildSteps(set), [set]);
  const [phase, setPhase] = useState<Phase>("check");
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"speaking" | "prep" | "answer">("speaking");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [captions, setCaptions] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ blob: Blob; url: string } | null>(null);
  const [result, setResult] = useState<SpeakingResultPayload | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  /** The next step to run once the examiner finishes a line (avoids self-recursion). */
  const [queued, setQueued] = useState<{ step: number; runId: number } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordStartedRef = useRef<number | null>(null);
  const recordedMsRef = useRef(0);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  useLeaveWarning(phase === "running" || phase === "finished");

  // Microphone level meter (also confirms the microphone works before starting).
  useEffect(() => {
    if (!stream || (phase !== "check" && phase !== "running")) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const value of data) peak = Math.max(peak, Math.abs(value - 128));
      setLevel(Math.min(1, peak / 64));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      void context.close();
    };
  }, [phase, stream]);

  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.pause();
      if (recordStartedRef.current != null) recordedMsRef.current += Date.now() - recordStartedRef.current;
      recordStartedRef.current = null;
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "paused") {
      recorder.resume();
      recordStartedRef.current = Date.now();
    }
  }, []);

  /** Plays the examiner's line: a generated clip when available, otherwise the browser's voice. */
  const speak = useCallback(
    (key: string, text: string) =>
      new Promise<void>((resolve) => {
        const src = clips[key];
        const fallback = () => {
          const synth = window.speechSynthesis;
          if (!synth) return resolve();
          // Some browsers never fire "end" (or have no voices): continue after a generous estimate.
          const safety = window.setTimeout(resolve, 2000 + text.split(/\s+/).length * 600);
          const utterance = new SpeechSynthesisUtterance(text);
          const voices = synth.getVoices();
          utterance.voice = voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
          utterance.lang = utterance.voice?.lang ?? "en-GB";
          utterance.rate = 0.95;
          utterance.onend = () => {
            window.clearTimeout(safety);
            resolve();
          };
          utterance.onerror = () => {
            window.clearTimeout(safety);
            resolve();
          };
          synth.cancel();
          synth.speak(utterance);
        };
        if (!src) return fallback();
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = src;
        audio.onended = () => resolve();
        audio.onerror = () => fallback();
        audio.play().catch(fallback);
      }),
    [clips]
  );

  const finish = useCallback(() => {
    runIdRef.current += 1;
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    pauseRecording();
    setDeadline(null);
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setRecordedSeconds(Math.round(recordedMsRef.current / 1000));
      setRecording({ blob, url: URL.createObjectURL(blob) });
      setPhase("finished");
    };
    if (recorder.state !== "inactive") recorder.stop();
  }, [pauseRecording]);

  const runStep = useCallback(
    async (i: number) => {
      const step = steps[i];
      if (!step || cancelledRef.current) return;
      const runId = ++runIdRef.current;
      const stale = () => cancelledRef.current || runId !== runIdRef.current;
      setIndex(i);
      setDeadline(null);
      pauseRecording();
      setStage("speaking");
      if (step.kind === "say") {
        await speak(step.key, EXAMINER_LINES[step.key]);
        if (stale()) return;
        if (i + 1 >= steps.length) finish();
        else setQueued({ step: i + 1, runId });
      } else if (step.kind === "ask") {
        await speak(step.key, step.text);
        if (stale()) return;
        setStage("answer");
        resumeRecording();
        setDeadline(Date.now() + step.seconds * 1000);
      } else if (step.kind === "cue") {
        await speak("p2-cue", cueCardScript(set));
        if (stale()) return;
        setStage("prep");
        setDeadline(Date.now() + PREP_SECONDS * 1000);
      } else {
        setStage("answer");
        resumeRecording();
        setDeadline(Date.now() + LONG_TURN_SECONDS * 1000);
      }
    },
    [steps, speak, pauseRecording, resumeRecording, finish, set]
  );

  useEffect(() => {
    if (!queued) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consuming a one-shot queue
    setQueued(null);
    if (queued.runId === runIdRef.current) void runStep(queued.step);
  }, [queued, runStep]);

  const secondsLeft = deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the answer timer ran out: move to the next step
    if (secondsLeft === 0 && phase === "running") void runStep(index + 1);
  }, [secondsLeft, phase, index, runStep]);

  async function checkMicrophone() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(`This browser cannot record audio here. ${microphoneHint()}`);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = media;
      setStream(media);
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setError(denied ? `Microphone permission was denied. ${microphoneHint()}` : "Could not use the microphone. Check that one is connected.");
    }
  }

  function startTest() {
    if (!stream) return;
    const mimeType = pickRecordingMimeType();
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    chunksRef.current = [];
    recordedMsRef.current = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    recorder.pause();
    // Unlock audio playback inside the click (mobile browsers require a gesture).
    const audio = new Audio();
    audioRef.current = audio;
    void audio.play().catch(() => {});
    setPhase("running");
    void runStep(0);
  }

  async function submit() {
    if (!recording) return;
    setError(null);
    setPhase("uploading");
    const outcome = await submitSpeaking(recording.blob, { setId: set.id, mode: "full", onScoring: () => setPhase("scoring") });
    if (!outcome.ok) {
      setPhase("finished");
      setError(outcome.error);
      return;
    }
    if (mock) {
      try {
        await mock.onSubmitted(outcome.result);
      } catch (e) {
        setPhase("finished");
        setError(e instanceof Error ? e.message : "Could not save this section. Please try again.");
        return;
      }
    }
    setResult(outcome.result);
    setPhase("done");
    router.refresh();
  }

  const step = steps[index];
  const partLabel = `Part ${step?.part ?? 1}`;
  const question =
    step?.kind === "ask" ? step.text : step?.kind === "say" ? EXAMINER_LINES[step.key] : step?.kind === "cue" ? set.part2.cue : "Speak about the topic on your card.";
  const questionNumber = step?.kind === "ask" ? steps.filter((s, i) => s.kind === "ask" && s.part === step.part && i <= index).length : null;

  return (
    <CbtShell
      title={`Speaking · ${set.title}`}
      subtitle={phase === "running" ? `${partLabel}${questionNumber ? ` · question ${questionNumber}` : ""}` : "Speaking test with examiner"}
      timer={phase === "running" && secondsLeft != null ? { seconds: secondsLeft, kind: "left" } : null}
      actions={
        phase === "check" && !mock ? (
          <Link href={exitHref} className={buttonClass("ghost", "px-2.5 py-1.5 text-xs")}>
            Exit
          </Link>
        ) : null
      }
    >
      <div data-scroll className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">
          {phase === "check" && (
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Before you start</p>
              <h1 className="mt-2 text-2xl font-semibold">Speaking test with a talking examiner</h1>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
                <li>About 11–14 minutes: Part 1 interview, Part 2 long turn (1 minute to prepare, up to 2 minutes to speak), Part 3 discussion.</li>
                <li>The examiner asks each question out loud. Answer as soon as the question ends; the next question comes automatically.</li>
                <li>Use headphones so the examiner&apos;s voice is not recorded. Only your answers are recorded.</li>
                <li>The whole test is scored at the end as one evaluation ({remainingEvaluations} left today).</li>
              </ul>
              <div className="mt-6 rounded-xl border border-line bg-sunken p-4">
                <p className="text-sm font-medium">Microphone check</p>
                {stream ? (
                  <>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface" aria-label="Microphone level" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                      <div className="h-full bg-good transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">Say something: the bar should move.</p>
                  </>
                ) : (
                  <Button variant="secondary" className="mt-3" onClick={() => void checkMicrophone()}>
                    Allow microphone
                  </Button>
                )}
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
                Show the examiner&apos;s questions as text (the real test has no captions)
              </label>
              {error && <Alert tone="error" className="mt-4">{error}</Alert>}
              {remainingEvaluations === 0 && (
                <Alert tone="info" className="mt-4">
                  You have used today&apos;s speaking evaluations. <Link href="/billing" className="font-medium underline">Upgrade to Pro</Link> for more.
                </Alert>
              )}
              <Button className="mt-6" onClick={startTest} disabled={!stream || remainingEvaluations === 0}>
                Start the test
              </Button>
            </div>
          )}

          {phase === "running" && step && (
            <div className="space-y-6 text-center">
              <ExaminerAvatar speaking={stage === "speaking"} />
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-text">{partLabel}</p>
              {stage === "speaking" && <p className="text-ink-soft">The examiner is speaking…</p>}
              {(captions || step.kind === "cue" || step.kind === "longTurn") && (
                <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-5 text-left shadow-soft">
                  {step.kind === "cue" || step.kind === "longTurn" ? (
                    <>
                      <p className="font-semibold">{set.part2.cue}</p>
                      <p className="mt-2 text-sm text-ink-faint">You should say:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{set.part2.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                    </>
                  ) : (
                    <p className="prose-reading">{question}</p>
                  )}
                </div>
              )}
              {stage === "prep" && <p className="text-lg font-medium">Prepare your talk. You can make notes on paper.</p>}
              {stage === "answer" && (
                <div className="space-y-3">
                  <p className="flex items-center justify-center gap-2 text-lg font-medium text-bad">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-bad" aria-hidden /> Recording your answer
                  </p>
                  <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-sunken" aria-hidden>
                    <div className="h-full bg-good transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="flex justify-center gap-2">
                {(stage === "answer" || stage === "prep") && (
                  <Button variant="secondary" onClick={() => void runStep(index + 1)}>
                    {stage === "prep" ? "I'm ready to speak" : step.kind === "longTurn" ? "I've finished" : "Next question"}
                  </Button>
                )}
                <Button variant="ghost" onClick={finish}>End test now</Button>
              </div>
            </div>
          )}

          {(phase === "finished" || phase === "uploading" || phase === "scoring") && recording && (
            <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-soft">
              <h2 className="text-lg font-semibold">Test complete</h2>
              <p className="text-sm text-ink-soft">You spoke for about {formatDuration(recordedSeconds)}. Listen back if you like, then submit for scoring.</p>
              <audio controls src={recording.url} className="w-full" aria-label="Your recording" />
              {recordedSeconds < 30 && <Alert tone="warning">The recording is shorter than 30 seconds, which is too short to score.</Alert>}
              {error && <Alert tone="error">{error}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void submit()} disabled={phase !== "finished" || recordedSeconds < 30}>
                  {phase === "uploading" ? "Uploading…" : phase === "scoring" ? "The examiner is scoring… (up to a minute)" : "Submit for scoring"}
                </Button>
                {!mock && (
                  <a href={`${exitHref}?set=${set.id}&exam=1`} className={buttonClass("ghost")}>
                    Retake
                  </a>
                )}
              </div>
            </div>
          )}

          {phase === "done" && result && (
            <div className="space-y-4">
              <SpeakingFeedback result={result} />
              <Link href={mock ? exitHref : `${exitHref}?set=${set.id}`} className={buttonClass("primary")}>
                {mock ? "Continue" : "Finish"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </CbtShell>
  );
}

function ExaminerAvatar({ speaking }: { speaking: boolean }) {
  return (
    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-line bg-accent-soft" aria-hidden>
      <div className="flex h-10 items-end gap-1">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-1.5 rounded-full bg-accent-btn ${speaking ? "animate-pulse" : ""}`}
            style={{ height: speaking ? `${[40, 80, 100, 70, 45][bar]}%` : "20%", animationDelay: `${bar * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
