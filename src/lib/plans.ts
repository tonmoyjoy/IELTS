/**
 * Plan catalogue. Payment integration only needs to set `user.plan`; every
 * quota check reads limits from here.
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
  free: {
    id: "free",
    name: "Free",
    dailyLimits: { speaking: 3, writing: 3 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    dailyLimits: { speaking: 30, writing: 30 },
  },
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(PLAN_IDS as readonly string[]).includes(id ?? "") ? (id as PlanId) : "free"];
}
