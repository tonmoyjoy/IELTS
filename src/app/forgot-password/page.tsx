"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    setResetUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "Request complete");
      setResetUrl(typeof data.resetUrl === "string" ? data.resetUrl : null);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reset password</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Enter your email and we will send a reset link.</p>
        <label className="mt-6 block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
        <button disabled={pending} className="mt-4 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Sending..." : "Send reset link"}
        </button>
        {message && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
        {resetUrl && <a href={resetUrl} className="mt-3 block text-sm font-medium text-emerald-700 underline">Open development reset link</a>}
        <Link href="/login" className="mt-5 block text-center text-sm text-zinc-600 hover:underline dark:text-zinc-300">Back to sign in</Link>
      </form>
    </main>
  );
}
