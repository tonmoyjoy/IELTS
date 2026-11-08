"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button, inputClass } from "@/components/ui";

export function UserActions({ userId, email, isPro }: { userId: string; email: string; isPro: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "grant" | "revoke">("idle");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const body = mode === "grant" ? { action: "grant", days, note: note || undefined } : { action: "revoke", note: note || undefined };
    const res = await apiFetch(`/api/admin/users/${userId}`, { body });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMode("idle");
    setNote("");
    router.refresh();
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setMode("grant")}>{isPro ? "Extend Pro" : "Give Pro"}</Button>
        {isPro && <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setMode("revoke")}>Remove Pro</Button>}
      </div>
    );
  }

  return (
    <div className="w-64 space-y-2">
      {mode === "grant" ? (
        <label className="block text-xs text-ink-soft">
          Days of Pro for {email}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputClass} mt-1 py-1.5 text-sm`}>
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
      ) : (
        <p className="text-xs text-ink-soft">Remove Pro from {email} now? This does not refund anything.</p>
      )}
      <label className="sr-only" htmlFor={`unote-${userId}`}>Note</label>
      <input id={`unote-${userId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className={`${inputClass} mt-0 py-1.5 text-sm`} />
      {error && <p className="text-xs text-bad">{error}</p>}
      <div className="flex gap-2">
        <Button className="px-3 py-1.5 text-xs" variant={mode === "grant" ? "primary" : "danger"} onClick={submit} disabled={pending}>
          {pending ? "Saving…" : mode === "grant" ? `Give ${days} days` : "Confirm remove"}
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setMode("idle")} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
