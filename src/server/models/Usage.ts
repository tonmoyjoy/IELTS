import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One document per user per UTC day, counting metered (AI-backed) actions.
 * The unique (user, day) index is what makes quota reservation atomic.
 * Documents are kept as a usage history (useful for billing disputes and
 * analytics); at one small document per active user per day they need no TTL.
 */
const usageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    speaking: { type: Number, default: 0, min: 0 },
    writing: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ user: 1, day: 1 }, { unique: true });

export type UsageDoc = InferSchemaType<typeof usageSchema>;

export const Usage: Model<UsageDoc> =
  (mongoose.models.Usage as Model<UsageDoc> | undefined) ?? mongoose.model<UsageDoc>("Usage", usageSchema);
