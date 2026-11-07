import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { Usage } from "@/server/models/Usage";
import { ApiError } from "@/server/http/api";
import { getPlan, METERED_FEATURES, type MeteredFeature, type PlanId } from "@/lib/plans";

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * Atomically reserves one unit of a metered feature for today.
 *
 * The conditional `$inc` only matches while the counter is below the limit.
 * When it does not match, the upsert tries to insert a second document for
 * the same (user, day) and the unique index rejects it — so two concurrent
 * requests can never both take the last slot. A duplicate-key error on the
 * very first request of the day (two racing inserts) is retried without
 * upsert.
 */
export async function reserveQuota(userId: string, planId: PlanId, feature: MeteredFeature): Promise<void> {
  const limit = getPlan(planId).dailyLimits[feature];
  await connectDb();
  const filter = { user: new Types.ObjectId(userId), day: utcDayKey(), [feature]: { $lt: limit } };
  const update = { $inc: { [feature]: 1 } };

  try {
    await Usage.updateOne(filter, update, { upsert: true });
    return;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }

  const retried = await Usage.updateOne(filter, update);
  if (retried.matchedCount > 0) return;

  throw new ApiError(
    429,
    "QUOTA_EXCEEDED",
    `You have used all ${limit} ${feature} evaluations included in your plan today. Your allowance resets at 00:00 UTC.`,
    { headers: { "Retry-After": String(Math.ceil((nextUtcMidnight().getTime() - Date.now()) / 1000)) } }
  );
}

/** Gives a reserved unit back when the AI call fails, so users are not charged for errors. */
export async function releaseQuota(userId: string, feature: MeteredFeature): Promise<void> {
  await connectDb();
  await Usage.updateOne(
    { user: new Types.ObjectId(userId), day: utcDayKey(), [feature]: { $gt: 0 } },
    { $inc: { [feature]: -1 } }
  );
}

export type UsageSummary = {
  plan: PlanId;
  resetsAt: string;
  features: Record<MeteredFeature, { used: number; limit: number; remaining: number }>;
};

export async function getUsageSummary(userId: string, planId: PlanId): Promise<UsageSummary> {
  await connectDb();
  const plan = getPlan(planId);
  const doc = await Usage.findOne({ user: new Types.ObjectId(userId), day: utcDayKey() }).lean();
  const features = {} as UsageSummary["features"];
  for (const feature of METERED_FEATURES) {
    const used = doc?.[feature] ?? 0;
    const limit = plan.dailyLimits[feature];
    features[feature] = { used, limit, remaining: Math.max(0, limit - used) };
  }
  return { plan: plan.id, resetsAt: nextUtcMidnight().toISOString(), features };
}
