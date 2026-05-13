"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ResetPasswordClient() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "Reset failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Choose a new password</h1>
        <label className="mt-6 block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="password">New password</label>
        <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <button disabled={pending || !token} className="mt-4 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Resetting..." : "Reset password"}
        </button>
        {message && <p className="mt-4 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">{message}</p>}
        <Link href="/login" className="mt-5 block text-center text-sm text-zinc-600 hover:underline dark:text-zinc-300">Back to sign in</Link>
      </form>
    </main>
  );
}
