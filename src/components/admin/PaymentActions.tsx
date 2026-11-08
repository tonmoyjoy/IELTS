"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Button, inputClass } from "@/components/ui";

export function PaymentActions({ paymentId, tranId }: { paymentId: string; tranId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await apiFetch(`/api/admin/payments/${paymentId}`, { body: { action: mode, note: note || undefined } });
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
        <Button className="px-3 py-1.5 text-xs" onClick={() => setMode("approve")}>Approve</Button>
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setMode("reject")}>Reject</Button>
      </div>
    );
  }

  return (
    <div className="w-64 space-y-2">
      <p className="text-xs text-ink-soft">
        {mode === "approve"
          ? `Approve ${tranId}? Only do this after confirming the money arrived in the SSLCommerz panel. Pro is granted immediately.`
          : `Reject ${tranId}? Refund it from the SSLCommerz panel if money was taken.`}
      </p>
      <label className="sr-only" htmlFor={`note-${paymentId}`}>Note</label>
      <input id={`note-${paymentId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${inputClass} mt-0 py-1.5 text-sm`} />
      {error && <p className="text-xs text-bad">{error}</p>}
      <div className="flex gap-2">
        <Button className="px-3 py-1.5 text-xs" variant={mode === "approve" ? "primary" : "danger"} onClick={submit} disabled={pending}>
          {pending ? "Saving…" : mode === "approve" ? "Confirm approve" : "Confirm reject"}
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setMode("idle")} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
