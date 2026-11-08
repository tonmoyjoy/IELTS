"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        We couldn&apos;t load this page. Please try again in a moment.
        {error.digest && <span className="mt-1 block text-xs text-ink-faint">Reference: {error.digest}</span>}
      </p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </main>
  );
}
