import { Schema, model } from "mongoose";

const researchItemSchema = new Schema(
  {
// who clipped it; becomes null if that person deletes their account (the clip stays with the collection)
userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "collection", required: true },
    source: {
      kind: { type: String, enum: ["web", "pdf"], default: "web" },
      url: String,
      dedupeKey: String, // url for web pages, file hash for PDFs
      fileName: String,
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
        authorEmail: String,
        text: String,
        highlightId: Schema.Types.ObjectId,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

researchItemSchema.index({ collectionId: 1, createdAt: -1 });
// no duplicate clips inside one collection (partial, so old unmigrated items don't collide)
researchItemSchema.index(
  { collectionId: 1, "source.dedupeKey": 1 },
  { unique: true, partialFilterExpression: { "source.dedupeKey": { $type: "string" } } }
);
researchItemSchema.index(
  { "source.title": "text", "aiOutput.summary": "text", "content.rawText": "text" },
  { name: "fulltext", weights: { "source.title": 10, "aiOutput.summary": 3, "content.rawText": 1 }, default_language: "none" }
);

export const ResearchItem = model("ResearchItem", researchItemSchema);