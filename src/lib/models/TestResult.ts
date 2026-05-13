import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const criteriaBreakdownSchema = new Schema(
  {
    fluency: { type: Number, required: true, min: 0, max: 9 },
    lexicalResource: { type: Number, required: true, min: 0, max: 9 },
    grammaticalRange: { type: Number, required: true, min: 0, max: 9 },
    /** Estimated from transcript; not acoustic analysis */
    pronunciation: { type: Number, required: true, min: 0, max: 9 },
  },
  { _id: false }
);

const testResultSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transcript: { type: String, required: true },
    bandScore: { type: Number, required: true, min: 0, max: 9 },
    breakdown: { type: criteriaBreakdownSchema, required: true },
    summary: { type: String },
    audio: {
      mimeType: { type: String },
      size: { type: Number },
      durationSeconds: { type: Number },
    },
    ai: {
      provider: { type: String },
      transcriptionModel: { type: String },
      evaluationModel: { type: String },
      promptVersion: { type: String },
    },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export type TestResultDoc = InferSchemaType<typeof testResultSchema>;

export const TestResult: Model<TestResultDoc> =
  mongoose.models.TestResult ??
  mongoose.model<TestResultDoc>("TestResult", testResultSchema);
