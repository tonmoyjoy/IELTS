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
    /** Billing plan; read through effectivePlan() so expiry is respected. */
    plan: { type: String, enum: PLAN_IDS, default: "free" },
    /** End of the paid period. Absent with plan "pro" means a manual, non-expiring grant. */
    planExpiresAt: { type: Date },
    targetBand: { type: Number, min: 1, max: 9, default: 7 },
    lastLoginAt: { type: Date },
    /** Google account id ("sub") once the user has signed in with Google. */
    googleId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ?? mongoose.model<UserDoc>("User", userSchema);
