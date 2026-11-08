import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/session";
import { listAdminPayments } from "@/server/services/admin";
import { ButtonLink, Card, Chip, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { AdminNav, StatusPill, formatDateTime } from "@/components/admin/AdminNav";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { formatBdt, getBillingOption } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin · Payments", robots: { index: false } };

const STATUSES = ["review", "pending", "paid", "failed", "cancelled"];

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdminPage();
  const params = await searchParams;
  const status = typeof params.status === "string" && STATUSES.includes(params.status) ? params.status : undefined;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const beforeRaw = typeof params.before === "string" ? new Date(params.before) : undefined;
  const before = beforeRaw && !Number.isNaN(beforeRaw.getTime()) ? beforeRaw : undefined;
  const { rows, nextCursor } = await listAdminPayments({ status, q, before, limit: 30 });

  const href = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries({ status, q: q || undefined, ...next })) if (v) query.set(k, v);
    const s = query.toString();
    return `/admin/payments${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Payments" description="Every checkout attempt. Search by customer email or reference (IPS…)." />
      <AdminNav active="/admin/payments" />

      <form action="/admin/payments" method="get" className="flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="min-w-64 flex-1 text-sm font-medium">
          Search
          <input name="q" defaultValue={q} placeholder="email@example.com or IPS…" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass("secondary")}>Search</button>
      </form>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Chip href={href({ status: undefined, before: undefined })} active={!status}>All</Chip>
        {STATUSES.map((s) => (
          <Chip key={s} href={href({ status: s, before: undefined })} active={status === s}>
            {s === "review" ? "Under review" : s[0].toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="No payments found" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDateTime(p.createdAt)}</td>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">{getBillingOption(p.optionId)?.label ?? p.optionId}</td>
                  <td className="px-4 py-3 tabular-nums">{formatBdt(p.amount)}</td>
                  <td className="px-4 py-3">{p.cardType ?? "—"}</td>
                  <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-faint">{p.tranId}</td>
                  <td className="px-4 py-3">
                    {(p.status === "review" || p.status === "pending") && <PaymentActions paymentId={p.id} tranId={p.tranId} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {nextCursor && (
        <div className="text-center">
          <ButtonLink href={href({ before: nextCursor })} variant="secondary">Older payments</ButtonLink>
        </div>
      )}
    </div>
  );
}
