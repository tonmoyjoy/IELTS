"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

const OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export function TargetBandForm({ initial }: { initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function update(next: number) {
    setValue(next);
    setStatus("saving");
    const res = await apiFetch("/api/account", { method: "PATCH", body: { targetBand: next } });
    setStatus(res.ok ? "idle" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <div className="mt-4 flex items-center gap-2 text-sm">
      <label htmlFor="target-band" className="text-zinc-600 dark:text-zinc-400">Change target</label>
      <select
        id="target-band"
        value={value}
        disabled={status === "saving"}
        onChange={(e) => void update(Number(e.target.value))}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        {OPTIONS.map((option) => (
          <option key={option} value={option}>{option.toFixed(1)}</option>
        ))}
      </select>
      {status === "error" && <span className="text-xs text-rose-600">Could not save</span>}
    </div>
  );
}
