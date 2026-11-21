import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const MOCK_SECTIONS = ["listening", "reading", "writing", "speaking"] as const;
export type MockSection = (typeof MOCK_SECTIONS)[number];

/**
 * A full mock test: Listening → Reading → Writing → Speaking in one sitting.
 * `sectionStartedAt` is set by the server when a section starts, so the
 * timer survives a page reload and cannot be reset from the browser.
 */
const mockTestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    section: { type: String, enum: [...MOCK_SECTIONS, "done"], default: "listening" },
    sectionStartedAt: { type: Date, default: null },
    listeningSetIds: { type: [String], required: true },
    readingSetIds: { type: [String], required: true },
    writingTaskIds: { type: [String], required: true },
    speakingSetId: { type: String, required: true },
    /** Per-section outcome, written once by the server. */
    results: { type: Schema.Types.Mixed, default: {} },
    overall: { type: Number, min: 0, max: 9 },
    completedAt: { type: Date },
  },
  { timestamps: true, minimize: false }
);

mockTestSchema.index({ user: 1, createdAt: -1 });

export type MockTestDoc = InferSchemaType<typeof mockTestSchema>;

export const MockTest: Model<MockTestDoc> =
  (mongoose.models.MockTest as Model<MockTestDoc> | undefined) ?? mongoose.model<MockTestDoc>("MockTest", mockTestSchema);
