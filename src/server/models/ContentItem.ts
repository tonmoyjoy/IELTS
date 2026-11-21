import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const CONTENT_KINDS = ["reading", "listening", "writing", "speaking"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * Practice content added through the admin editor. Built-in content lives in
 * `src/content`; published items here are merged with it by
 * `server/content/catalog.ts`.
 *
 * - `payload` is the public shape (ReadingSet, ListeningSet, WritingTask, SpeakingSet) and may be sent to browsers.
 * - `answers` and `script` are server-only, exactly like `answer-keys.ts` and `listening-scripts.json`.
 */
const contentItemSchema = new Schema(
  {
    kind: { type: String, enum: CONTENT_KINDS, required: true },
    /** Public id used in URLs and as the attempt's contentId. Never changes once published. */
    slug: { type: String, required: true, unique: true, maxlength: 80 },
    status: { type: String, enum: CONTENT_STATUSES, default: "draft" },
    title: { type: String, required: true, maxlength: 200 },
    payload: { type: Schema.Types.Mixed, required: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    script: { type: Schema.Types.Mixed, default: null },
    /** Generated audio: listening recording, or speaking examiner clips keyed like "p1-0". */
    audio: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, enum: ["ai", "manual", "copy"], default: "manual" },
    brief: { type: String, maxlength: 2000 },
    createdBy: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true, minimize: false }
);

contentItemSchema.index({ kind: 1, status: 1, publishedAt: -1 });
contentItemSchema.index({ updatedAt: -1 });

export type ContentItemDoc = InferSchemaType<typeof contentItemSchema>;

export const ContentItem: Model<ContentItemDoc> =
  (mongoose.models.ContentItem as Model<ContentItemDoc> | undefined) ?? mongoose.model<ContentItemDoc>("ContentItem", contentItemSchema);
