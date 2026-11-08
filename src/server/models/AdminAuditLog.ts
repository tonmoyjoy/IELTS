import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Append-only record of every admin action, for accountability and support. */
const adminAuditLogSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    targetUser: { type: Schema.Types.ObjectId, ref: "User" },
    targetEmail: { type: String },
    payment: { type: Schema.Types.ObjectId, ref: "Payment" },
    note: { type: String, maxlength: 500 },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });

export type AdminAuditLogDoc = InferSchemaType<typeof adminAuditLogSchema>;

export const AdminAuditLog: Model<AdminAuditLogDoc> =
  (mongoose.models.AdminAuditLog as Model<AdminAuditLogDoc> | undefined) ??
  mongoose.model<AdminAuditLogDoc>("AdminAuditLog", adminAuditLogSchema);
