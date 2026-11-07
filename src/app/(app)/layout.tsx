import { requirePageUser } from "@/server/auth/session";
import { AppHeader } from "@/components/app/AppHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("/dashboard");
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} plan={user.plan} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-zinc-500">
        Practice scores are estimates, not official IELTS results.
      </footer>
    </div>
  );
}
