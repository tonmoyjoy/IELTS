import "server-only";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { Payment, PAYMENT_STATUSES, type PaymentStatus } from "@/server/models/Payment";
import { User } from "@/server/models/User";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import { AdminAuditLog } from "@/server/models/AdminAuditLog";
import { ApiError } from "@/server/http/api";
import { extendPro } from "@/server/billing/payments";
import { effectivePlan, type PlanId } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminActor = { id: string; email: string };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function audit(
  actor: AdminActor,
  action: string,
  fields: { targetUser?: Types.ObjectId; targetEmail?: string; payment?: Types.ObjectId; note?: string; details?: unknown }
) {
  await AdminAuditLog.create({
    admin: new Types.ObjectId(actor.id),
    adminEmail: actor.email,
    action,
    ...fields,
    note: fields.note?.slice(0, 500),
  });
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type RevenueStats = {
  revenue: { today: number; last30Days: number; allTime: number };
  paidCount: { today: number; last30Days: number; allTime: number };
  byOption: Array<{ optionId: string; count: number; amount: number }>;
  activePro: number;
  totalUsers: number;
  newUsers30Days: number;
  needsReview: number;
};

export async function getRevenueStats(now = new Date()): Promise<RevenueStats> {
  await connectDb();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const paid = await Payment.find({ status: "paid" }).select("amount optionId paidAt").lean();
  const sum = (rows: typeof paid) => rows.reduce((total, row) => total + row.amount, 0);
  const today = paid.filter((p) => p.paidAt && p.paidAt >= startOfDay);
  const recent = paid.filter((p) => p.paidAt && p.paidAt >= thirtyDaysAgo);

  const byOptionMap = new Map<string, { count: number; amount: number }>();
  for (const row of paid) {
    const entry = byOptionMap.get(row.optionId) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += row.amount;
    byOptionMap.set(row.optionId, entry);
  }

  const [activePro, totalUsers, newUsers30Days, needsReview] = await Promise.all([
    User.countDocuments({ plan: "pro", $or: [{ planExpiresAt: { $gt: now } }, { planExpiresAt: null }] }),
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Payment.countDocuments({ status: "review" }),
  ]);

  return {
    revenue: { today: sum(today), last30Days: sum(recent), allTime: sum(paid) },
    paidCount: { today: today.length, last30Days: recent.length, allTime: paid.length },
    byOption: [...byOptionMap.entries()].map(([optionId, v]) => ({ optionId, ...v })).sort((a, b) => b.amount - a.amount),
    activePro,
    totalUsers,
    newUsers30Days,
    needsReview,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type AdminPaymentRow = {
  id: string;
  tranId: string;
  userId: string;
  email: string;
  optionId: string;
  amount: number;
  status: PaymentStatus;
  cardType: string | null;
  riskLevel: string | null;
  createdAt: string;
  paidAt: string | null;
};

export async function listAdminPayments(options: {
  status?: string;
  q?: string;
  limit?: number;
  before?: Date;
}): Promise<{ rows: AdminPaymentRow[]; nextCursor: string | null }> {
  await connectDb();
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const filter: Record<string, unknown> = {};
  if (options.status && (PAYMENT_STATUSES as readonly string[]).includes(options.status)) filter.status = options.status;
  if (options.before) filter.createdAt = { $lt: options.before };

  const q = options.q?.trim();
  if (q) {
    if (/^IPS[A-Z0-9]+$/i.test(q)) {
      filter.tranId = q.toUpperCase();
    } else {
      const users = await User.find({ email: { $regex: `^${escapeRegex(q.toLowerCase())}` } }).select("_id").limit(50).lean();
      filter.user = { $in: users.map((u) => u._id) };
    }
  }

  const docs = await Payment.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
  const page = docs.slice(0, limit);
  const users = await User.find({ _id: { $in: page.map((p) => p.user) } }).select("email").lean();
  const emails = new Map(users.map((u) => [String(u._id), u.email]));

  const rows = page.map((p) => ({
    id: String(p._id),
    tranId: p.tranId,
    userId: String(p.user),
    email: emails.get(String(p.user)) ?? "(deleted user)",
    optionId: p.optionId,
    amount: p.amount,
    status: p.status as PaymentStatus,
    cardType: p.cardType ?? null,
    riskLevel: p.riskLevel ?? null,
    createdAt: (p.createdAt ?? new Date()).toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  }));
  return { rows, nextCursor: docs.length > limit ? rows[rows.length - 1]?.createdAt ?? null : null };
}

/**
 * Approves a payment the admin has checked in the SSLCommerz merchant panel
 * (held for review, or never confirmed because the IPN could not reach us).
 * Grants Pro exactly once, like an automatic confirmation.
 */
export async function approvePayment(actor: AdminActor, paymentId: string, note?: string): Promise<void> {
  if (!Types.ObjectId.isValid(paymentId)) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
  await connectDb();
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
  if (payment.status === "paid") throw new ApiError(409, "ALREADY_PAID", "This payment is already approved.");
  if (payment.status !== "review" && payment.status !== "pending") {
    throw new ApiError(409, "NOT_APPROVABLE", "Only payments under review or still pending can be approved.");
  }

  const claimed = await Payment.updateOne(
    { _id: payment._id, status: payment.status },
    { $set: { status: "paid", paidAt: new Date() } }
  );
  if (claimed.modifiedCount !== 1) throw new ApiError(409, "CHANGED", "This payment changed in the meantime. Refresh and try again.");

  const grantedUntil = await extendPro(payment.user, payment.days);
  if (grantedUntil) await Payment.updateOne({ _id: payment._id }, { $set: { grantedUntil } });
  await audit(actor, "payment.approve", {
    targetUser: payment.user,
    payment: payment._id,
    note,
    details: { tranId: payment.tranId, previousStatus: payment.status, days: payment.days, amount: payment.amount },
  });
}

/** Rejects a payment under review. Any refund is issued from the SSLCommerz merchant panel. */
export async function rejectPayment(actor: AdminActor, paymentId: string, note?: string): Promise<void> {
  if (!Types.ObjectId.isValid(paymentId)) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
  await connectDb();
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw new ApiError(404, "NOT_FOUND", "Payment not found.");
  if (payment.status !== "review" && payment.status !== "pending") {
    throw new ApiError(409, "NOT_REJECTABLE", "Only payments under review or still pending can be rejected.");
  }
  const updated = await Payment.updateOne({ _id: payment._id, status: payment.status }, { $set: { status: "failed" } });
  if (updated.modifiedCount !== 1) throw new ApiError(409, "CHANGED", "This payment changed in the meantime. Refresh and try again.");
  await audit(actor, "payment.reject", {
    targetUser: payment.user,
    payment: payment._id,
    note,
    details: { tranId: payment.tranId, previousStatus: payment.status },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string;
  plan: PlanId;
  planExpiresAt: string | null;
  manualPro: boolean;
  emailVerified: boolean;
  google: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  attempts: number;
  paidPayments: number;
};

export async function searchUsers(q: string, limit = 25): Promise<AdminUserRow[]> {
  await connectDb();
  const term = q.trim().toLowerCase();
  const filter = term ? { email: { $regex: `^${escapeRegex(term)}` } } : {};
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .select("email plan planExpiresAt emailVerified googleId createdAt lastLoginAt")
    .lean();

  return Promise.all(
    users.map(async (u) => ({
      id: String(u._id),
      email: u.email,
      plan: effectivePlan(u.plan, u.planExpiresAt),
      planExpiresAt: u.planExpiresAt ? u.planExpiresAt.toISOString() : null,
      manualPro: u.plan === "pro" && !u.planExpiresAt,
      emailVerified: Boolean(u.emailVerified),
      google: Boolean(u.googleId),
      createdAt: (u.createdAt ?? new Date()).toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      attempts: await PracticeAttempt.countDocuments({ user: u._id }),
      paidPayments: await Payment.countDocuments({ user: u._id, status: "paid" }),
    }))
  );
}

async function loadUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) throw new ApiError(404, "NOT_FOUND", "User not found.");
  await connectDb();
  const user = await User.findById(userId).select("email plan planExpiresAt").lean();
  if (!user) throw new ApiError(404, "NOT_FOUND", "User not found.");
  return user;
}

/** Adds days of Pro (e.g. a support gesture, a bank transfer, a giveaway). */
export async function grantPro(actor: AdminActor, userId: string, days: number, note?: string): Promise<Date | null> {
  const user = await loadUser(userId);
  const until = await extendPro(user._id, days);
  await audit(actor, "user.grant_pro", { targetUser: user._id, targetEmail: user.email, note, details: { days, until } });
  return until;
}

/** Ends Pro immediately. Does not refund; refunds go through SSLCommerz. */
export async function revokePro(actor: AdminActor, userId: string, note?: string): Promise<void> {
  const user = await loadUser(userId);
  await User.updateOne({ _id: user._id }, { $set: { plan: "free" }, $unset: { planExpiresAt: 1 } });
  await audit(actor, "user.revoke_pro", {
    targetUser: user._id,
    targetEmail: user.email,
    note,
    details: { previousPlan: user.plan, previousExpiry: user.planExpiresAt ?? null },
  });
}

export type AuditRow = { id: string; adminEmail: string; action: string; targetEmail: string | null; note: string | null; createdAt: string };

export async function listAudit(limit = 20): Promise<AuditRow[]> {
  await connectDb();
  const rows = await AdminAuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  const ids = rows.map((r) => r.targetUser).filter(Boolean) as Types.ObjectId[];
  const users = await User.find({ _id: { $in: ids } }).select("email").lean();
  const emails = new Map(users.map((u) => [String(u._id), u.email]));
  return rows.map((r) => ({
    id: String(r._id),
    adminEmail: r.adminEmail,
    action: r.action,
    targetEmail: r.targetEmail ?? (r.targetUser ? emails.get(String(r.targetUser)) ?? null : null),
    note: r.note ?? null,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
  }));
}
