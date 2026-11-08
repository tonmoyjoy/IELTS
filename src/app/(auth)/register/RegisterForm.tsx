"use client";

import { useState } from "react";
import { apiFetch, firstFieldError } from "@/lib/api-client";
import { Alert, Button, inputClass, labelClass } from "@/components/ui";
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
        <p className="text-sm text-ink-soft">
          Sent to <span className="font-medium text-ink">{email}</span>. The link expires in 24 hours.
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
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email}
          aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        {emailError && <p id="email-error" className="mt-1 text-xs text-bad">{emailError}</p>}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password}
          aria-invalid={Boolean(passwordError)} aria-describedby="password-help"
          onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <p id="password-help" className={`mt-1 text-xs ${passwordError ? "text-bad" : "text-ink-faint"}`}>
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
