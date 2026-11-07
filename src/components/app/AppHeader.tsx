import Link from "next/link";
import { NavLinks } from "@/components/app/NavLinks";
import { SignOutButton } from "@/components/app/SignOutButton";
import { getPlan, type PlanId } from "@/lib/plans";

export function AppHeader({ email, plan }: { email: string; plan: PlanId }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
          IELTS Practice Studio
        </Link>
        <NavLinks />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden max-w-[16rem] truncate text-zinc-500 md:inline" title={email}>
            {email}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {getPlan(plan).name}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
