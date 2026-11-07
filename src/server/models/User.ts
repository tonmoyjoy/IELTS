import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PLAN_IDS } from "@/lib/plans";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** bcrypt hash. Never selected by default. */
    password: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, index: { sparse: true } },
    emailVerificationExpires: { type: Date },
    passwordResetTokenHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpires: { type: Date },
    /** Bumped to revoke every session issued before (password reset, sign out everywhere). */
    tokenVersion: { type: Number, default: 0 },
    /** Billing plan. Payment integration flips this; quotas read it. */
    plan: { type: String, enum: PLAN_IDS, default: "free" },
    targetBand: { type: Number, min: 1, max: 9, default: 7 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ?? mongoose.model<UserDoc>("User", userSchema);
