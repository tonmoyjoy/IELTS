"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      className="px-2 py-1"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
        router.replace("/login");
        router.refresh();
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
