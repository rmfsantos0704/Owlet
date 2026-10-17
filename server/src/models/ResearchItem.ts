import { Schema, model } from "mongoose";

const researchItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    source: {
      url: { type: String, required: true },
      domain: String,
      title: String,
      author: String,
      publishedDate: String,
    },
    content: { rawText: String, wordCount: Number },
    aiOutput: { summary: String, paraphrase: String },
    citations: { apa: String, mla: String, chicago: String },
    tags: [String],
    highlights: [
      {
        text: String,
        color: { type: String, default: "yellow" },
        note: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        text: String,
        highlightId: Schema.Types.ObjectId,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

researchItemSchema.index({ userId: 1, "source.url": 1 }, { unique: true });

export const ResearchItem = model("ResearchItem", researchItemSchema);