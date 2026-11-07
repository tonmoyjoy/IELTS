"use client";

import { useState } from "react";
import { apiFetch, firstFieldError } from "@/lib/api-client";
import { Alert, Button, inputClass } from "@/components/ui";
import { ResendVerification } from "@/components/auth/ResendVerification";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]> | undefined>();
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields(undefined);
    setPending(true);
    const res = await apiFetch<{ message: string }>("/api/auth/register", { body: { email, password } });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      setFields(res.fields);
      return;
    }
    setDone(res.data.message);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{done}</Alert>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sent to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>. The link expires in 24 hours.
          Didn&apos;t get it? Check your spam folder or send another.
        </p>
        <ResendVerification email={email} />
      </div>
    );
  }

  const emailError = firstFieldError(fields, "email");
  const passwordError = firstFieldError(fields, "password");

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email}
          aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        {emailError && <p id="email-error" className="mt-1 text-xs text-rose-600">{emailError}</p>}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password}
          aria-invalid={Boolean(passwordError)} aria-describedby="password-help"
          onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <p id="password-help" className={`mt-1 text-xs ${passwordError ? "text-rose-600" : "text-zinc-500"}`}>
          {passwordError ?? "At least 8 characters."}
        </p>
      </div>
      {error && !emailError && !passwordError && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
