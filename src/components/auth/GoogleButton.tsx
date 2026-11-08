import { buttonClass } from "@/components/ui";

/** Plain link: the OAuth flow is a full-page redirect, so no client JavaScript is needed. */
export function GoogleButton({ from, label = "Continue with Google" }: { from?: string; label?: string }) {
  const href = `/api/auth/google/start${from ? `?from=${encodeURIComponent(from)}` : ""}`;
  return (
    <div className="space-y-5">
      <a href={href} className={buttonClass("secondary", "w-full py-3")}>
        {label}
      </a>
      <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_expired: "That sign-in attempt expired. Please try again.",
  google_failed: "We couldn't sign you in with Google. Please try again.",
  google_mismatch: "This email is already linked to a different Google account.",
  google_unavailable: "Google sign-in isn't available right now. Use your email and password instead.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};
