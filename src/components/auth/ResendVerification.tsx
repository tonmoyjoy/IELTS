"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Alert, Button } from "@/components/ui";

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    const res = await apiFetch<{ message: string }>("/api/auth/resend-verification", { body: { email } });
    if (res.ok) {
      setState("sent");
      setMessage(res.data.message);
    } else {
      setState("error");
      setMessage(res.error);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={resend} disabled={state === "sending" || state === "sent" || !email}>
        {state === "sending" ? "Sending…" : state === "sent" ? "Link sent" : "Resend verification email"}
      </Button>
      {message && <Alert tone={state === "error" ? "error" : "success"}>{message}</Alert>}
    </div>
  );
}
