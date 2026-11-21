"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button } from "@/components/ui";
import type { MockSectionName } from "@/lib/mock";
import type { WritingTask, SpeakingSet } from "@/content/types";
import type { TestPartSpec } from "@/content/tests";
import { ObjectiveTest, type PartResult } from "@/components/cbt/ObjectiveTest";
import { WritingTest, type WritingResult } from "@/components/cbt/WritingTest";
import { SpeakingExam } from "@/components/cbt/SpeakingExam";
import type { SpeakingResultPayload } from "@/lib/speaking-upload";

export function StartMockButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setPending(true);
    setError(null);
    const res = await apiFetch<{ mock: { id: string } }>("/api/mock", { body: {} });
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.push(`/practice/mock/${res.data.mock.id}`);
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => void start()} disabled={pending}>{pending ? "Preparing your test…" : "Start a new mock test"}</Button>
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}

export function StartSectionButton({ mockId, label }: { mockId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setPending(true);
    const res = await apiFetch(`/api/mock/${mockId}/start`, { body: {} });
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.refresh();
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => void start()} disabled={pending}>{pending ? "Starting…" : label}</Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

function useSectionSubmit(mockId: string, section: MockSectionName) {
  const router = useRouter();
  return async (attemptIds: string[]) => {
    const res = await apiFetch(`/api/mock/${mockId}/section`, { body: { section, attemptIds } });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
  };
}

export function MockObjectiveSection({
  mockId,
  section,
  title,
  parts,
  deadline,
}: {
  mockId: string;
  section: "listening" | "reading";
  title: string;
  parts: TestPartSpec[];
  deadline: string;
}) {
  const submit = useSectionSubmit(mockId, section);
  return (
    <ObjectiveTest
      module={section}
      title={title}
      parts={parts}
      storageKey={`ielts:mock:${mockId}:${section}`}
      exitHref={`/practice/mock/${mockId}`}
      mock={{ deadline: Date.parse(deadline), onSubmitted: (results: PartResult[]) => submit(results.map((r) => r.attempt.id)) }}
    />
  );
}

export function MockWritingSection({ mockId, tasks, deadline, remaining }: { mockId: string; tasks: WritingTask[]; deadline: string; remaining: number }) {
  const submit = useSectionSubmit(mockId, "writing");
  return (
    <WritingTest
      tasks={tasks}
      title="Mock test · Writing"
      storageKey={`ielts:mock:${mockId}:writing`}
      exitHref={`/practice/mock/${mockId}`}
      remainingEvaluations={remaining}
      mock={{
        deadline: Date.parse(deadline),
        onSubmitted: (results: WritingResult[]) => submit(results.flatMap((r) => (r.attemptId ? [r.attemptId] : []))),
      }}
    />
  );
}

export function MockSpeakingSection({ mockId, set, clips, remaining }: { mockId: string; set: SpeakingSet; clips: Record<string, string>; remaining: number }) {
  const submit = useSectionSubmit(mockId, "speaking");
  return (
    <SpeakingExam
      set={set}
      clips={clips}
      remainingEvaluations={remaining}
      exitHref={`/practice/mock/${mockId}`}
      mock={{ onSubmitted: (result: SpeakingResultPayload) => submit([result.attempt.id]) }}
    />
  );
}
