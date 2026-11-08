"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, firstFieldError } from "@/lib/api-client";
import { Alert, Button, ButtonLink, inputClass, labelClass } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    const res = await apiFetch<{ message: string }>("/api/auth/reset-password", { body: { token, password } });
    setPending(false);
    if (!res.ok) {
      setError(firstFieldError(res.fields, "password") ?? res.error);
      return;
    }
    setDone(res.data.message);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{done}</Alert>
        <ButtonLink href="/login" className="w-full">Sign in</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>Confirm new password</label>
        <input id="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      </div>
      {error && (
        <Alert tone="error">
          {error}{" "}
          {error.includes("expired") && <Link href="/forgot-password" className="font-medium underline">Request a new link</Link>}
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
