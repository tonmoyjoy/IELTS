/**
 * Plan catalogue and prices. Paying for any billing option grants Pro for
 * that many days; buying again while Pro is active extends it.
 */

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const METERED_FEATURES = ["speaking", "writing"] as const;
export type MeteredFeature = (typeof METERED_FEATURES)[number];

export type Plan = {
  id: PlanId;
  name: string;
  /** AI evaluations allowed per UTC day. */
  dailyLimits: Record<MeteredFeature, number>;
};

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", dailyLimits: { speaking: 3, writing: 3 } },
  pro: { id: "pro", name: "Pro", dailyLimits: { speaking: 30, writing: 30 } },
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(PLAN_IDS as readonly string[]).includes(id ?? "") ? (id as PlanId) : "free"];
}

export const BILLING_OPTION_IDS = ["pro-1m", "pro-3m", "pro-12m"] as const;
export type BillingOptionId = (typeof BILLING_OPTION_IDS)[number];

export type BillingOption = {
  id: BillingOptionId;
  label: string;
  days: number;
  /** Price in Bangladeshi taka. */
  amountBdt: number;
  note?: string;
};

export const BILLING_OPTIONS: BillingOption[] = [
  { id: "pro-1m", label: "1 month", days: 30, amountBdt: 300 },
  { id: "pro-3m", label: "3 months", days: 90, amountBdt: 600, note: "Save 33%" },
  { id: "pro-12m", label: "12 months", days: 365, amountBdt: 1500, note: "Best value · save 58%" },
];

export function getBillingOption(id: string): BillingOption | undefined {
  return BILLING_OPTIONS.find((option) => option.id === id);
}

/** A user is Pro while their plan is "pro" and it has not expired (no expiry = granted manually). */
export function effectivePlan(plan: string | null | undefined, expiresAt: Date | null | undefined, now = new Date()): PlanId {
  if (plan !== "pro") return "free";
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return "free";
  return "pro";
}

export function formatBdt(amount: number): string {
  return `৳${amount.toLocaleString("en-US")}`;
}
