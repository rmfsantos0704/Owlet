import { Schema, model } from "mongoose";

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isDefault: { type: Boolean, default: false },
    members: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["editor", "viewer"], default: "viewer" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    aiSettings: {
      format: { type: String, enum: ["paragraph", "bullets", "academic", "simple"], default: "paragraph" },
      length: { type: String, enum: ["short", "medium", "detailed"], default: "medium" },
      instructions: { type: String, maxlength: 500, default: "" },
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ "members.userId": 1 });
// one Personal workspace per user
workspaceSchema.index({ ownerId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const Workspace = model("Workspace", workspaceSchema);