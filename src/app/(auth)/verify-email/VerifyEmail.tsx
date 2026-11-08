"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button, ButtonLink } from "@/components/ui";

/**
 * Verification is a deliberate button press rather than automatic on page
 * load, so email link scanners that prefetch URLs cannot consume the token.
 */
export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!token) {
    return <Alert tone="error">This verification link is incomplete. Sign in to request a new one.</Alert>;
  }

  async function verify() {
    setState("pending");
    const res = await apiFetch<{ message: string }>("/api/auth/verify-email", { body: { token } });
    if (res.ok) {
      setState("done");
      setMessage(res.data.message);
    } else {
      setState("error");
      setMessage(res.error);
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <Alert tone="success">{message}</Alert>
        <ButtonLink href="/login" className="w-full">Sign in</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Confirm your email address to activate your account.</p>
      {state === "error" && (
        <Alert tone="error">
          {message} <Link href="/login" className="font-medium underline">Sign in</Link> to request a new link.
        </Alert>
      )}
      <Button onClick={verify} disabled={state === "pending"} className="w-full">
        {state === "pending" ? "Verifying…" : "Verify my email"}
      </Button>
    </div>
  );
}
