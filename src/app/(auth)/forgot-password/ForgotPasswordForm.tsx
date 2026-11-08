"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button, inputClass, labelClass } from "@/components/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const res = await apiFetch<{ message: string }>("/api/auth/forgot-password", { body: { email } });
    setPending(false);
    setResult(res.ok ? { tone: "success", message: res.data.message } : { tone: "error", message: res.error });
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      {result && <Alert tone={result.tone}>{result.message}</Alert>}
      <Button type="submit" disabled={pending || result?.tone === "success"} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
