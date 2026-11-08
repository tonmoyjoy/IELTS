import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/session";
import { listPayments } from "@/server/billing/payments";
import { isPaymentConfigured } from "@/server/billing/sslcommerz";
import { getUsageSummary } from "@/server/billing/quota";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { CheckoutForm } from "@/components/billing/CheckoutForm";
import { BILLING_OPTIONS, PLANS, formatBdt, getBillingOption, type BillingOptionId } from "@/lib/plans";

export const metadata: Metadata = { title: "Plan & billing" };

const STATUS_MESSAGES: Record<string, { tone: "success" | "warning" | "error" | "info"; text: string }> = {
  success: { tone: "success", text: "Payment received — Pro is now active. Thank you!" },
  pending: { tone: "info", text: "We're confirming your payment with the gateway. This usually takes under a minute; refresh to check." },
  review: { tone: "warning", text: "Your payment is being reviewed by our team. Pro will be activated once it's confirmed; contact support if it takes more than a day." },
  failed: { tone: "error", text: "The payment didn't go through and you weren't charged. Please try again." },
  cancelled: { tone: "info", text: "Payment cancelled. You weren't charged." },
};

/** SSLCommerz card_type looks like "BKASH-BKash" or "VISA-Dutch Bangla"; show the readable part. */
function formatMethod(cardType: string | null): string {
  if (!cardType) return "—";
  const [scheme, ...rest] = cardType.split("-");
  const name = rest.join("-").trim();
  return name ? (scheme === "VISA" || scheme === "MASTER" || scheme === "AMEX" ? `${scheme === "MASTER" ? "Mastercard" : scheme === "AMEX" ? "Amex" : "Visa"} · ${name}` : name) : cardType;
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  review: "Under review",
};

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePageUser("/billing");
  const params = await searchParams;
  const status = typeof params.payment === "string" ? STATUS_MESSAGES[params.payment] : undefined;
  const requested = typeof params.plan === "string" ? getBillingOption(params.plan) : undefined;
  const initialOption: BillingOptionId = requested?.id ?? "pro-3m";

  const [payments, usage] = await Promise.all([listPayments(user.id), getUsageSummary(user.id, user.plan)]);
  const configured = isPaymentConfigured();
  const until = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Plan & billing" title={user.plan === "pro" ? "You're on Pro" : "Upgrade to Pro"}
        description={`Pro gives you ${PLANS.pro.dailyLimits.writing} Writing and ${PLANS.pro.dailyLimits.speaking} Speaking evaluations every day. Listening and Reading are always unlimited.`} />

      {status && <Alert tone={status.tone}>{status.text}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Current plan</p>
          <p className="mt-3 font-serif text-3xl font-semibold">{PLANS[user.plan].name}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {user.plan === "pro" ? (until ? `Active until ${until}.` : "Active.") : "Free forever, with daily limits on AI scoring."}
          </p>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Today&apos;s AI evaluations</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["writing", "speaking"] as const).map((feature) => (
              <div key={feature}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium capitalize text-ink">{feature}</span>
                  <span className="tabular-nums text-ink-soft">
                    {usage.features[feature].used} / {usage.features[feature].limit} used
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (usage.features[feature].used / usage.features[feature].limit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">Resets daily at 00:00 UTC (6:00 am in Bangladesh).</p>
        </Card>
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="font-serif text-xl font-semibold">{user.plan === "pro" ? "Extend Pro" : "Get Pro"}</h2>
        <div className="mt-6">
          {configured ? (
            <CheckoutForm initialOption={initialOption} extending={user.plan === "pro"} />
          ) : (
            <Alert tone="info">
              Online payments are being set up. Plans: {BILLING_OPTIONS.map((o) => `${o.label} ${formatBdt(o.amountBdt)}`).join(" · ")}.
            </Alert>
          )}
        </div>
      </Card>

      <section aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="font-serif text-xl font-semibold">Payment history</h2>
        <div className="mt-4">
          {payments.length === 0 ? (
            <EmptyState title="No payments yet" description="Your receipts will appear here." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-5 py-3 tabular-nums">{new Date(payment.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="px-5 py-3">{getBillingOption(payment.optionId)?.label ?? payment.optionId}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBdt(payment.amount)}</td>
                      <td className="px-5 py-3">{formatMethod(payment.cardType)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${payment.status === "paid" ? "bg-good-soft text-good" : payment.status === "review" ? "bg-warn-soft text-warn" : "bg-sunken text-ink-soft"}`}>
                          {PAYMENT_LABELS[payment.status] ?? payment.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-faint">{payment.tranId}</td>
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
