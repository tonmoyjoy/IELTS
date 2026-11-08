import Link from "next/link";
import { NavLinks } from "@/components/app/NavLinks";
import { SignOutButton } from "@/components/app/SignOutButton";
import { ComfortMenu } from "@/components/app/ComfortMenu";
import { Logo } from "@/components/app/Logo";
import type { PlanId } from "@/lib/plans";

export function AppHeader({ email, plan, planExpiresAt }: { email: string; plan: PlanId; planExpiresAt: string | null }) {
  const until = planExpiresAt
    ? new Date(planExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" aria-label="IELTS Practice Studio home">
          <Logo />
        </Link>
        <NavLinks />
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/billing"
            title={plan === "pro" ? (until ? `Pro until ${until}` : "Pro") : "Upgrade to Pro"}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              plan === "pro" ? "bg-accent-soft text-accent-text" : "border border-accent/50 text-accent-text hover:bg-accent-soft"
            }`}
          >
            {plan === "pro" ? (until ? `Pro · until ${until}` : "Pro") : "Upgrade"}
          </Link>
          <ComfortMenu />
          <span className="sr-only">Signed in as {email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
