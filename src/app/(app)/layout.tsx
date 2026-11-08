import { requirePageUser } from "@/server/auth/session";
import { AppHeader } from "@/components/app/AppHeader";
import { BreakReminder } from "@/components/app/BreakReminder";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("/dashboard");
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} plan={user.plan} planExpiresAt={user.planExpiresAt} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-faint">
        Practice scores are estimates, not official IELTS results.
      </footer>
      <BreakReminder />
    </div>
  );
}
