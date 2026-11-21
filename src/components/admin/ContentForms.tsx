"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button, Card, inputClass, labelClass } from "@/components/ui";

type Kind = "reading" | "listening" | "writing" | "speaking";
type BuiltIn = Record<Kind, Array<{ id: string; title: string }>>;

const KIND_LABELS: Record<Kind, string> = { reading: "Reading passage", listening: "Listening part", writing: "Writing task", speaking: "Speaking topic" };

export function NewContentPanel({ builtIn }: { builtIn: BuiltIn }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("reading");
  const [variant, setVariant] = useState(1);
  const [pending, setPending] = useState<"draft" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending("draft");
    setError(null);
    const res = await apiFetch<{ item: { id: string } }>("/api/admin/content", {
      body: {
        action: "draft",
        kind,
        topic: String(form.get("topic") ?? ""),
        notes: String(form.get("notes") ?? "") || undefined,
        variant: kind === "listening" || kind === "writing" ? variant : undefined,
      },
    });
    if (!res.ok) {
      setPending(null);
      setError(res.error);
      return;
    }
    router.push(`/admin/content/${res.data.item.id}`);
  }

  async function copy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const [copyKind, sourceId] = String(form.get("source") ?? "").split(":");
    setPending("copy");
    setError(null);
    const res = await apiFetch<{ item: { id: string } }>("/api/admin/content", { body: { action: "copy", kind: copyKind, sourceId } });
    if (!res.ok) {
      setPending(null);
      setError(res.error);
      return;
    }
    router.push(`/admin/content/${res.data.item.id}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <h2 className="font-semibold">New draft with AI</h2>
        <p className="mt-1 text-sm text-ink-soft">Gemini writes an original test with questions, answers and explanations. It stays a draft until you review and publish it.</p>
        <form method="post" onSubmit={draft} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputClass}>
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </label>
          {kind === "listening" && (
            <label className={labelClass}>
              Part
              <select value={variant} onChange={(e) => setVariant(Number(e.target.value))} className={inputClass}>
                <option value={1}>Part 1: everyday conversation</option>
                <option value={2}>Part 2: everyday monologue</option>
                <option value={3}>Part 3: academic discussion</option>
                <option value={4}>Part 4: lecture</option>
              </select>
            </label>
          )}
          {kind === "writing" && (
            <label className={labelClass}>
              Task
              <select value={variant} onChange={(e) => setVariant(Number(e.target.value))} className={inputClass}>
                <option value={1}>Task 1: chart</option>
                <option value={2}>Task 2: essay</option>
              </select>
            </label>
          )}
          <label className={`${labelClass} sm:col-span-2`}>
            Topic
            <input name="topic" required minLength={3} maxLength={200} placeholder="e.g. how bees navigate, renting a flat, the history of tea" className={inputClass} />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Notes for the AI (optional)
            <textarea name="notes" maxLength={1000} rows={2} placeholder="e.g. harder vocabulary; include a matching headings task" className={inputClass} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending !== null}>{pending === "draft" ? "Writing the draft… (up to a minute)" : "Create draft"}</Button>
          </div>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Start from a built-in set</h2>
        <p className="mt-1 text-sm text-ink-soft">Copies a built-in test as a template you can rewrite.</p>
        <form method="post" onSubmit={copy} className="mt-4 space-y-3">
          <label className={labelClass}>
            Built-in set
            <select name="source" className={inputClass} required>
              {(Object.keys(builtIn) as Kind[]).map((k) => (
                <optgroup key={k} label={KIND_LABELS[k]}>
                  {builtIn[k].map((item) => (
                    <option key={item.id} value={`${k}:${item.id}`}>{item.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" disabled={pending !== null}>{pending === "copy" ? "Copying…" : "Copy as draft"}</Button>
        </form>
      </Card>
      {error && <Alert tone="error" className="lg:col-span-3">{error}</Alert>}
    </div>
  );
}
