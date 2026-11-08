import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/session";
import { searchUsers } from "@/server/services/admin";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { AdminNav, formatDateTime } from "@/components/admin/AdminNav";
import { UserActions } from "@/components/admin/UserActions";

export const metadata: Metadata = { title: "Admin · Users", robots: { index: false } };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdminPage();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const users = await searchUsers(q, 30);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Users" description="Find a user by email, then give, extend or remove Pro. Every change is logged." />
      <AdminNav active="/admin/users" />

      <form action="/admin/users" method="get" className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1 text-sm font-medium">
          Email starts with
          <input name="q" defaultValue={q} placeholder="rahim@" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass("secondary")}>Search</button>
      </form>

      {users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{u.email}</p>
                    <p className="text-xs text-ink-faint">
                      {u.emailVerified ? "Verified" : "Not verified"}
                      {u.google ? " · Google" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.plan === "pro" ? "Pro" : "Free"}</p>
                    <p className="text-xs text-ink-faint">
                      {u.plan === "pro" ? (u.manualPro ? "No expiry" : `Until ${formatDateTime(u.planExpiresAt)}`) : u.planExpiresAt ? `Expired ${formatDateTime(u.planExpiresAt)}` : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {u.attempts} attempts · {u.paidPayments} paid
                    <p className="text-xs text-ink-faint">Last sign-in {formatDateTime(u.lastLoginAt)}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3"><UserActions userId={u.id} email={u.email} isPro={u.plan === "pro"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
