import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/server/auth/session";
import { getRevenueStats, listAdminPayments, listAudit } from "@/server/services/admin";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AdminNav, StatusPill, formatDateTime } from "@/components/admin/AdminNav";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { formatBdt, getBillingOption } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </Card>
  );
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const [stats, review, audit] = await Promise.all([
    getRevenueStats(),
    listAdminPayments({ status: "review", limit: 20 }),
    listAudit(15),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Overview" description="Revenue, payments that need a decision, and recent admin activity." />
      <AdminNav active="/admin" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue today" value={formatBdt(stats.revenue.today)} sub={`${stats.paidCount.today} payments (UTC day)`} />
        <Stat label="Last 30 days" value={formatBdt(stats.revenue.last30Days)} sub={`${stats.paidCount.last30Days} payments`} />
        <Stat label="All time" value={formatBdt(stats.revenue.allTime)} sub={`${stats.paidCount.allTime} payments`} />
        <Stat label="Active Pro" value={String(stats.activePro)} sub={`${stats.totalUsers} users · ${stats.newUsers30Days} new in 30 days`} />
      </div>

      {stats.byOption.length > 0 && (
        <Card className="p-6">
          <h2 className="font-serif text-lg font-semibold">Sales by plan</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {stats.byOption.map((row) => (
              <li key={row.optionId} className="rounded-xl bg-sunken px-4 py-3">
                <p className="text-sm font-medium">{getBillingOption(row.optionId)?.label ?? row.optionId}</p>
                <p className="text-sm text-ink-soft tabular-nums">{row.count} sold · {formatBdt(row.amount)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="review-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="review-heading" className="font-serif text-xl font-semibold">Needs review ({stats.needsReview})</h2>
          <Link href="/admin/payments?status=review" className="text-sm font-medium text-accent-text hover:underline">All payments</Link>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Held automatically because the amount didn&apos;t match or SSLCommerz flagged them as high risk. Check each one in the SSLCommerz merchant panel before deciding.
        </p>
        <div className="mt-4">
          {review.rows.length === 0 ? (
            <EmptyState title="Nothing to review" description="Payments that need a manual decision will appear here." />
          ) : (
            <Card className="divide-y divide-line">
              {review.rows.map((p) => (
                <div key={p.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="text-sm">
                    <p className="font-medium text-ink">{p.email}</p>
                    <p className="text-ink-soft">
                      {getBillingOption(p.optionId)?.label ?? p.optionId} · {formatBdt(p.amount)} · {p.cardType ?? "unknown method"}
                      {p.riskLevel === "1" ? " · high risk" : ""}
                    </p>
                    <p className="font-mono text-xs text-ink-faint">{p.tranId} · {formatDateTime(p.createdAt)}</p>
                    <div className="mt-2"><StatusPill status={p.status} /></div>
                  </div>
                  <PaymentActions paymentId={p.id} tranId={p.tranId} />
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>

      <section aria-labelledby="audit-heading">
        <h2 id="audit-heading" className="font-serif text-xl font-semibold">Recent admin activity</h2>
        <div className="mt-4">
          {audit.length === 0 ? (
            <EmptyState title="No admin actions yet" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Admin</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {audit.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatDateTime(row.createdAt)}</td>
                      <td className="px-5 py-3">{row.adminEmail}</td>
                      <td className="px-5 py-3 font-mono text-xs">{row.action}</td>
                      <td className="px-5 py-3">{row.targetEmail ?? "—"}</td>
                      <td className="px-5 py-3 text-ink-soft">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
