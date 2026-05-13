import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const practiceAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    module: {
      type: String,
      enum: ["speaking", "writing", "reading", "listening"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 9 },
    rawScore: { type: Number, min: 0 },
    totalQuestions: { type: Number, min: 0 },
    summary: { type: String },
    details: { type: Schema.Types.Mixed },
    ai: {
      provider: { type: String },
      model: { type: String },
      promptVersion: { type: String },
      latencyMs: { type: Number },
    },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type PracticeAttemptDoc = InferSchemaType<typeof practiceAttemptSchema>;

export const PracticeAttempt: Model<PracticeAttemptDoc> =
  mongoose.models.PracticeAttempt ??
  mongoose.model<PracticeAttemptDoc>("PracticeAttempt", practiceAttemptSchema);
