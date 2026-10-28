import mongoose, { Schema } from "mongoose";

// One saved run of the AI workspace. Private to the person who ran it, scoped to a collection.
const aiSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection", required: true },
    mode: { type: String, enum: ["Research brief", "Summarize", "Compare sources"], required: true },
    prompt: { type: String, default: "", maxlength: 1000 },
    // snapshot of what was used, so the session still reads correctly if a clip is deleted later
    sources: [{ _id: false, id: String, title: String }],
    summary: { type: String, default: "" },
    findings: [
      {
        _id: false,
        title: String,
        text: String,
        sources: [Number],
        evidence: [{ _id: false, source: Number, quote: String, verified: Boolean }],
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiSessionSchema.index({ userId: 1, collectionId: 1, createdAt: -1 });

export const AiSession = mongoose.model("AiSession", aiSessionSchema);