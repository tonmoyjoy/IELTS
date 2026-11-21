import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * MP3 audio generated on the server (Gemini TTS) for admin-created content.
 * Stored in MongoDB so it works on read-only and serverless hosts; served by
 * GET /api/audio/[id] with long-lived caching (clips are immutable).
 */
const audioClipSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    mimeType: { type: String, default: "audio/mpeg" },
    bytes: { type: Number, required: true },
    label: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type AudioClipDoc = InferSchemaType<typeof audioClipSchema>;

export const AudioClip: Model<AudioClipDoc> =
  (mongoose.models.AudioClip as Model<AudioClipDoc> | undefined) ?? mongoose.model<AudioClipDoc>("AudioClip", audioClipSchema);
