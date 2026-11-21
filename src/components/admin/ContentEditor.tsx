"use client";

import { Component, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button, Card, buttonClass } from "@/components/ui";
import { TaskVisual } from "@/components/practice/TaskVisual";
import { StatusPill, formatDateTime } from "@/components/admin/AdminNav";
import { Modal } from "@/components/cbt/CbtShell";
import type { ContentDetail } from "@/server/services/content-admin";
import type { ListeningSet, QuestionGroup, ReadingSet, SpeakingSet, WritingTask } from "@/content/types";

type Doc = { payload: Record<string, unknown>; answers?: Record<string, { display: string; accept: string[]; explanation: string }>; script?: unknown };

function initialText(item: ContentDetail) {
  const doc: Doc = { payload: item.payload as Record<string, unknown> };
  if (item.kind === "reading" || item.kind === "listening") doc.answers = item.answers;
  if (item.kind === "listening") doc.script = item.script;
  return JSON.stringify(doc, null, 2);
}

export function ContentEditor({ item, practiceHref }: { item: ContentDetail; practiceHref: string }) {
  const router = useRouter();
  const [text, setText] = useState(() => initialText(item));
  const [errors, setErrors] = useState<string[]>(item.errors);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const published = item.status === "published";

  const parsed = useMemo((): { doc: Doc | null; error: string | null } => {
    try {
      const value = JSON.parse(text) as Doc;
      if (!value || typeof value !== "object" || typeof value.payload !== "object") return { doc: null, error: 'The JSON needs a "payload" object.' };
      return { doc: value, error: null };
    } catch (e) {
      return { doc: null, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [text]);

  const dirty = text !== initialText(item);

  async function send(action: string, withBody = true) {
    if (withBody && !parsed.doc) return;
    setPending(action);
    setMessage(null);
    const body = withBody ? { action, payload: parsed.doc!.payload, answers: parsed.doc!.answers, script: parsed.doc!.script } : { action };
    const res = await apiFetch<{ item?: ContentDetail; errors?: string[]; ok?: boolean }>(`/api/admin/content/${item.id}`, { body });
    setPending(null);
    setConfirm(null);
    if (!res.ok) {
      setErrors(res.fields?.content ?? errors);
      setMessage({ tone: "error", text: res.error });
      return;
    }
    if (action === "delete") {
      router.push("/admin/content");
      return;
    }
    if (action === "validate") {
      setErrors(res.data.errors ?? []);
      setMessage(res.data.errors?.length ? null : { tone: "success", text: "No problems found. Save, then publish." });
      return;
    }
    if (res.data.item) {
      setErrors(res.data.item.errors);
      setText(initialText(res.data.item));
    }
    setMessage({ tone: "success", text: action === "save" ? "Saved." : action === "publish" ? "Published. Students can see it now." : "Unpublished. It is a draft again." });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusPill status={item.status} />
          <span className="text-ink-faint">id: {item.slug}</span>
          <span className="text-ink-faint">updated {formatDateTime(item.updatedAt)}</span>
          {item.publishedAt && <span className="text-ink-faint">published {formatDateTime(item.publishedAt)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {published ? (
            <>
              <Link href={practiceHref} className={buttonClass("secondary")} target="_blank">Open as a student</Link>
              <Button variant="secondary" onClick={() => setConfirm("unpublish")} disabled={Boolean(pending)}>Unpublish to edit</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => void send("validate")} disabled={Boolean(pending) || !parsed.doc}>
                {pending === "validate" ? "Checking…" : "Check"}
              </Button>
              <Button variant="secondary" onClick={() => void send("save")} disabled={Boolean(pending) || !parsed.doc || !dirty}>
                {pending === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button onClick={() => setConfirm("publish")} disabled={Boolean(pending) || dirty || errors.length > 0}>Publish</Button>
              {!item.publishedAt && (
                <Button variant="ghost" onClick={() => setConfirm("delete")} disabled={Boolean(pending)}>Delete</Button>
              )}
            </>
          )}
        </div>
      </Card>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {dirty && !published && <Alert tone="info">You have unsaved changes. Save the draft before publishing.</Alert>}
      {errors.length > 0 && (
        <Alert tone="warning">
          <p className="font-semibold">{errors.length} problem{errors.length === 1 ? "" : "s"} to fix before publishing:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.slice(0, 15).map((error) => <li key={error}>{error}</li>)}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-sm">
            <span className="font-semibold">Content (JSON)</span>
            {parsed.error ? <span className="text-bad">{parsed.error}</span> : <span className="text-ink-faint">Valid JSON</span>}
          </div>
          <label htmlFor="content-json" className="sr-only">Content JSON</label>
          <textarea
            id="content-json"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={published}
            spellCheck={false}
            className="min-h-[36rem] w-full flex-1 resize-y rounded-b-2xl border-0 bg-raised p-4 font-mono text-xs leading-5 text-ink focus:outline-none"
          />
        </Card>
        <Card className="max-h-[48rem] overflow-y-auto p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-text">Preview</p>
          {parsed.doc ? (
            <PreviewBoundary key={text}>
              <Preview kind={item.kind} doc={parsed.doc} />
            </PreviewBoundary>
          ) : <p className="mt-2 text-sm text-ink-faint">Fix the JSON to see the preview.</p>}
        </Card>
      </div>

      {confirm && (
        <Modal
          title={confirm === "publish" ? "Publish this test?" : confirm === "unpublish" ? "Unpublish this test?" : "Delete this draft?"}
          onClose={pending ? undefined : () => setConfirm(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)} disabled={Boolean(pending)}>Cancel</Button>
              <Button variant={confirm === "delete" ? "danger" : "primary"} onClick={() => void send(confirm, false)} disabled={Boolean(pending)}>
                {pending ? (confirm === "publish" && (item.kind === "listening" || item.kind === "speaking") ? "Recording the audio… (1–3 min)" : "Working…") : confirm === "publish" ? "Publish" : confirm === "unpublish" ? "Unpublish" : "Delete"}
              </Button>
            </>
          }
        >
          {confirm === "publish" &&
            (item.kind === "listening" || item.kind === "speaking"
              ? "Gemini will record the audio first, then students can take this test. Keep this page open."
              : "Students can take this test straight away, and it may appear in mock tests.")}
          {confirm === "unpublish" && "Students will no longer see it. Past attempts and mock results keep their scores."}
          {confirm === "delete" && "This draft will be removed permanently."}
        </Modal>
      )}
    </div>
  );
}

function QuestionsPreview({ groups, answers }: { groups: QuestionGroup[]; answers: Doc["answers"] }) {
  return (
    <div className="mt-6 space-y-5">
      {groups?.map((group, gi) => (
        <section key={gi}>
          <h3 className="text-sm font-semibold">{group.range}</h3>
          <p className="text-sm text-ink-soft">{group.instructions}</p>
          <ol className="mt-2 space-y-3">
            {group.questions?.map((q) => {
              const key = answers?.[q.id];
              return (
                <li key={q.id} className="rounded-lg border border-line p-3 text-sm">
                  <p>
                    <span className="mr-2 font-semibold tabular-nums">{q.number}.</span>
                    {q.prompt}
                  </p>
                  {q.kind === "choice" && (
                    <ul className="mt-1 text-xs text-ink-soft">{q.options?.map((o) => <li key={o.value}>{o.label}</li>)}</ul>
                  )}
                  {q.kind === "text" && <p className="mt-1 text-xs text-ink-faint">Max {q.maxWords} word(s){q.allowNumber ? " and/or a number" : ""}</p>}
                  <p className={`mt-2 text-xs ${key ? "text-good" : "text-bad"}`}>
                    {key ? <>Answer: <strong>{key.accept?.join(" / ")}</strong> — {key.explanation}</> : "No answer"}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Malformed drafts must not crash the editor: the preview just stops rendering. */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="mt-2 text-sm text-ink-faint">The preview can&apos;t show this shape. Use Check to see what&apos;s wrong.</p>
    ) : (
      this.props.children
    );
  }
}

function Preview({ kind, doc }: { kind: ContentDetail["kind"]; doc: Doc }) {
  {
    if (kind === "reading") {
      const set = doc.payload as unknown as ReadingSet;
      return (
        <div className="mt-2">
          <h2 className="font-serif text-xl font-semibold">{set.passage?.heading}</h2>
          <div className="prose-reading mt-3 space-y-3">
            {set.passage?.paragraphs?.map((p) => (
              <p key={p.label}><span className="mr-2 font-sans text-sm font-bold text-accent-text">{p.label}</span>{p.text}</p>
            ))}
          </div>
          <QuestionsPreview groups={set.groups} answers={doc.answers} />
        </div>
      );
    }
    if (kind === "listening") {
      const set = doc.payload as unknown as ListeningSet;
      const script = doc.script as { intro?: string; lines?: Array<{ speaker: string; text: string }> } | null;
      return (
        <div className="mt-2">
          <p className="text-sm text-ink-soft">Part {set.section} · {set.summary}</p>
          {script?.intro && <p className="mt-3 text-sm italic text-ink-soft">Narrator: {script.intro}</p>}
          <div className="prose-reading mt-3 space-y-2">
            {script?.lines?.map((line, i) => (
              <p key={i}><span className="mr-2 font-sans text-sm font-semibold text-ink-faint">{line.speaker}:</span>{line.text}</p>
            ))}
          </div>
          <QuestionsPreview groups={set.groups} answers={doc.answers} />
        </div>
      );
    }
    if (kind === "writing") {
      const task = doc.payload as unknown as WritingTask;
      return (
        <div className="mt-2 space-y-3">
          <p className="text-sm font-semibold">Writing Task {task.task} · {task.minutes} minutes · at least {task.minWords} words</p>
          <div className="prose-reading rounded-xl border border-line bg-sunken p-4">
            <p>{task.prompt}</p>
            {task.question && <p className="mt-2 font-semibold">{task.question}</p>}
          </div>
          {task.visual && <TaskVisual visual={task.visual} />}
        </div>
      );
    }
    const set = doc.payload as unknown as SpeakingSet;
    return (
      <div className="mt-2 space-y-4 text-sm">
        <div><p className="font-semibold">Part 1</p><ul className="list-disc pl-5">{set.part1?.map((q) => <li key={q}>{q}</li>)}</ul></div>
        <div>
          <p className="font-semibold">Part 2</p>
          <p>{set.part2?.cue}</p>
          <ul className="list-disc pl-5 text-ink-soft">{set.part2?.bullets?.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
        <div><p className="font-semibold">Part 3</p><ul className="list-disc pl-5">{set.part3?.map((q) => <li key={q}>{q}</li>)}</ul></div>
      </div>
    );
  }
}
