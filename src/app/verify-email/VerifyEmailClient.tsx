"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [message, setMessage] = useState(token ? "Verifying your email..." : "Missing verification token.");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function verify() {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      setOk(res.ok);
      setMessage(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "Verification failed");
    }
    if (token) void verify();
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Email verification</h1>
        <p className={`mt-4 text-sm ${ok ? "text-emerald-700" : "text-zinc-600 dark:text-zinc-300"}`}>{message}</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
