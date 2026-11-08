import { requireAdminPage } from "@/server/auth/session";
import { AppHeader } from "@/components/app/AppHeader";

/**
 * Admin area. Separate from the (app) group on purpose: it has no streaming
 * loading boundary, so the admin check runs before anything is sent and
 * non-admins get a real HTTP 404.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  return (
    <div className="min-h-screen">
      <AppHeader email={user.email} plan={user.plan} planExpiresAt={user.planExpiresAt} isAdmin />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        {children}
      </main>
    </div>
  );
}
