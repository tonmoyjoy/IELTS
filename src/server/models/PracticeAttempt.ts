import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MODULES } from "@/lib/modules";

const practiceAttemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    module: { type: String, enum: MODULES, required: true },
    /** Id of the reading/listening set, writing task or speaking set. */
    contentId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    /** Band score 0–9 in half-band steps. Always computed on the server. */
    score: { type: Number, required: true, min: 0, max: 9 },
    rawScore: { type: Number, min: 0 },
    totalQuestions: { type: Number, min: 1 },
    summary: { type: String, maxlength: 2000 },
    /** Server-built payload: graded answers, AI feedback, transcript, essay. */
    details: { type: Schema.Types.Mixed },
    ai: {
      provider: { type: String },
      model: { type: String },
      transcriptionModel: { type: String },
      promptVersion: { type: String },
      latencyMs: { type: Number },
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

practiceAttemptSchema.index({ user: 1, date: -1 });
practiceAttemptSchema.index({ user: 1, module: 1, date: -1 });
practiceAttemptSchema.index({ user: 1, contentId: 1, date: -1 });

export type PracticeAttemptDoc = InferSchemaType<typeof practiceAttemptSchema>;

export const PracticeAttempt: Model<PracticeAttemptDoc> =
  (mongoose.models.PracticeAttempt as Model<PracticeAttemptDoc> | undefined) ??
  mongoose.model<PracticeAttemptDoc>("PracticeAttempt", practiceAttemptSchema);
