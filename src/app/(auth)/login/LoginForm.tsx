"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button, inputClass, labelClass } from "@/components/ui";
import { ResendVerification } from "@/components/auth/ResendVerification";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const res = await apiFetch("/api/auth/login", { body: { email, password } });
    if (!res.ok) {
      setError({ message: res.error, code: res.code });
      setPending(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClass}>Password</label>
          <Link href="/forgot-password" className="text-xs font-medium text-accent-text hover:underline">
            Forgot password?
          </Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      {error && <Alert tone="error">{error.message}</Alert>}
      {error?.code === "EMAIL_NOT_VERIFIED" && <ResendVerification email={email} />}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
