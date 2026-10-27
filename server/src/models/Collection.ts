import { Schema, model } from "mongoose";
import mongoose from 'mongoose';
const collectionSchema = new Schema(
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
    // One shareable join link per collection. Regenerating replaces it, so the old link stops working.
    joinLink: {
      token: { type: String },
      role: { type: String, enum: ["editor", "viewer"] },
      expiresAt: { type: Date },
      maxUses: { type: Number, default: null }, // null = unlimited until it expires
      uses: { type: Number, default: 0 },
      createdAt: { type: Date },
    },
    aiSettings: {
      format: { type: String, enum: ["paragraph", "bullets", "academic", "simple"], default: "paragraph" },
      length: { type: String, enum: ["short", "medium", "detailed"], default: "medium" },
      instructions: { type: String, maxlength: 500, default: "" },
    },
  },
  { timestamps: true }
);

collectionSchema.index({ ownerId: 1 });
collectionSchema.index({ "joinLink.token": 1 }, { unique: true, sparse: true });
collectionSchema.index({ "members.userId": 1 });
// one Personal collection per user
collectionSchema.index({ ownerId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

// Check if the model already exists before compiling it
export const collection = mongoose.models.Collection || mongoose.model('Collection', collectionSchema);