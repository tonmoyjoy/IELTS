import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { Payment, type PaymentStatus } from "@/server/models/Payment";
import { User } from "@/server/models/User";
import { ApiError } from "@/server/http/api";
import { getAppUrl } from "@/server/env";
import { log } from "@/server/log";
import { initSession, validatePayment } from "@/server/billing/sslcommerz";
import { getBillingOption, type BillingOptionId } from "@/lib/plans";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Our reference for SSLCommerz (max 30 chars, unguessable). */
export function newTranId(): string {
  return `IPS${Date.now().toString(36).toUpperCase()}${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function startCheckout(input: {
  userId: string;
  email: string;
  optionId: BillingOptionId;
  name: string;
  phone: string;
}): Promise<{ gatewayUrl: string }> {
  const option = getBillingOption(input.optionId);
  if (!option) throw new ApiError(400, "INVALID_PLAN", "Choose a valid plan.");

  await connectDb();
  const tranId = newTranId();
  const payment = await Payment.create({
    user: new Types.ObjectId(input.userId),
    tranId,
    optionId: option.id,
    days: option.days,
    amount: option.amountBdt,
    currency: "BDT",
    status: "pending",
  });

  const api = `${getAppUrl()}/api/billing/sslcommerz`;
  try {
    const session = await initSession({
      tranId,
      amount: option.amountBdt,
      productName: `IELTS Practice Studio Pro (${option.label})`,
      customer: { name: input.name, email: input.email, phone: input.phone },
      urls: { success: `${api}/success`, fail: `${api}/fail`, cancel: `${api}/cancel`, ipn: `${api}/ipn` },
    });
    await Payment.updateOne({ _id: payment._id }, { $set: { sessionKey: session.sessionKey } });
    return { gatewayUrl: session.gatewayUrl };
  } catch (error) {
    await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed" } });
    if (error instanceof ApiError) throw error;
    log.error("billing.init_failed", { tranId, error });
    throw new ApiError(502, "PAYMENT_INIT_FAILED", "We couldn't reach the payment gateway. Please try again in a moment.");
  }
}

/**
 * Extends the user's Pro period by `days`, starting from the later of now and
 * the current expiry. Uses compare-and-set so two payments confirmed at the
 * same moment both count.
 */
async function extendPro(userId: Types.ObjectId, days: number): Promise<Date | null> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await User.findById(userId).select("plan planExpiresAt").lean();
    if (!user) throw new Error("User not found for payment");
    const current = user.planExpiresAt ?? null;
    // A manual non-expiring Pro grant stays non-expiring.
    if (user.plan === "pro" && !current) return null;
    const base = Math.max(Date.now(), current?.getTime() ?? 0);
    const next = new Date(base + days * DAY_MS);
    const result = await User.updateOne(
      { _id: userId, planExpiresAt: current },
      { $set: { plan: "pro", planExpiresAt: next } }
    );
    if (result.matchedCount === 1) return next;
  }
  throw new Error("Could not extend plan after concurrent updates");
}

export type ConfirmOutcome = "paid" | "already_paid" | "review" | "rejected";

/**
 * Confirms a payment using the gateway's validation API (never the data the
 * browser posted). Idempotent: success redirect and IPN may both call this.
 */
export async function confirmPayment(valId: string, postedTranId?: string): Promise<ConfirmOutcome> {
  const result = await validatePayment(valId);
  if (result.status !== "VALID" && result.status !== "VALIDATED") {
    log.warn("billing.validation_rejected", { status: result.status, postedTranId });
    return "rejected";
  }

  const tranId = result.tran_id ?? "";
  if (!tranId || (postedTranId && postedTranId !== tranId)) {
    log.warn("billing.tran_mismatch", { tranId, postedTranId });
    return "rejected";
  }

  await connectDb();
  const payment = await Payment.findOne({ tranId }).lean();
  if (!payment) {
    log.warn("billing.unknown_tran", { tranId });
    return "rejected";
  }
  if (payment.status === "paid") return "already_paid";

  const amount = Number(result.amount);
  const currency = result.currency_type ?? result.currency;
  if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.009 || currency !== payment.currency) {
    log.error("billing.amount_mismatch", { tranId, expected: payment.amount, amount: result.amount, currency });
    await Payment.updateOne({ _id: payment._id, status: { $ne: "paid" } }, { $set: { status: "review", valId } });
    return "review";
  }

  const details = {
    valId,
    cardType: result.card_type,
    bankTranId: result.bank_tran_id,
    riskLevel: result.risk_level,
  };

  if (result.risk_level === "1") {
    log.warn("billing.high_risk", { tranId });
    await Payment.updateOne({ _id: payment._id, status: { $ne: "paid" } }, { $set: { ...details, status: "review" } });
    return "review";
  }

  // Claim the payment exactly once; only the caller that flips it to "paid" grants Pro.
  const claimed = await Payment.updateOne(
    { _id: payment._id, status: { $ne: "paid" } },
    { $set: { ...details, status: "paid", paidAt: new Date() } }
  );
  if (claimed.modifiedCount !== 1) return "already_paid";

  const grantedUntil = await extendPro(payment.user, payment.days);
  if (grantedUntil) await Payment.updateOne({ _id: payment._id }, { $set: { grantedUntil } });
  log.info("billing.paid", { tranId, days: payment.days });
  return "paid";
}

/** Fail/cancel callbacks only ever downgrade a still-pending payment. */
export async function markPaymentClosed(tranId: string, status: Extract<PaymentStatus, "failed" | "cancelled">) {
  if (!tranId) return;
  await connectDb();
  await Payment.updateOne({ tranId, status: "pending" }, { $set: { status } });
}

export type PaymentRow = {
  id: string;
  tranId: string;
  optionId: string;
  amount: number;
  status: PaymentStatus;
  cardType: string | null;
  createdAt: string;
  grantedUntil: string | null;
};

export async function listPayments(userId: string, limit = 20): Promise<PaymentRow[]> {
  await connectDb();
  const rows = await Payment.find({ user: new Types.ObjectId(userId), status: { $ne: "pending" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    id: String(row._id),
    tranId: row.tranId,
    optionId: row.optionId,
    amount: row.amount,
    status: row.status as PaymentStatus,
    cardType: row.cardType ?? null,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    grantedUntil: row.grantedUntil ? row.grantedUntil.toISOString() : null,
  }));
}
