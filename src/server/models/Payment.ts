import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BILLING_OPTION_IDS } from "@/lib/plans";

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled", "review"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * One checkout attempt. `tranId` is our reference sent to SSLCommerz.
 * A payment only becomes "paid" after the gateway's validation API confirms
 * it; "review" means the gateway flagged it as high risk and Pro was not
 * granted automatically.
 */
const paymentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tranId: { type: String, required: true, unique: true },
    optionId: { type: String, enum: BILLING_OPTION_IDS, required: true },
    days: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "BDT" },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "pending" },
    sessionKey: { type: String },
    valId: { type: String },
    cardType: { type: String },
    bankTranId: { type: String },
    riskLevel: { type: String },
    paidAt: { type: Date },
    /** Pro end date after this payment was applied. */
    grantedUntil: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentDoc> =
  (mongoose.models.Payment as Model<PaymentDoc> | undefined) ?? mongoose.model<PaymentDoc>("Payment", paymentSchema);
