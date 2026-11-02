import { Schema, model } from "mongoose";

const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    generations: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

aiUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 35 });

export const AiUsage = model("AiUsage", aiUsageSchema);
