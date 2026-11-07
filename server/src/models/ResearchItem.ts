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
      authors: [String],
      publishedDate: String,
      journal: String,
      volume: String,
      issue: String,
      pages: String,
      doi: String,
      filePathname: String, // where the original PDF is kept (Vercel Blob); set on PDF imports
      fileUrl: String, // public, unguessable address the PDF viewer opens
    },
    content: {
      rawText: String,
      wordCount: Number,
      pageOffsets: [Number],
    },
    matrixValues: { type: Map, of: String, default: {} },
    personalNote: { type: String, trim: true, maxlength: 280, default: "" },
    readingStatus: { type: String, enum: ["to_read", "reading", "done"], default: "to_read", index: true },
    userSummary: { type: String, trim: true, maxlength: 2000, default: "" },
    aiOutput: { summary: String, paraphrase: String },
    aiQuotaExceeded: { type: Boolean, default: false },
    // per-clip summary settings (set from the AI settings modal on the clip page)
    aiSettings: {
      format: { type: String, enum: ["paragraph", "bullets", "academic", "simple"], default: "paragraph" },
      length: { type: String, enum: ["short", "medium", "detailed"], default: "medium" },
      instructions: { type: String, default: "" },
    },
    citations: { apa: String, mla: String, chicago: String },
    tags: [String],
    highlights: [
      {
        text: String,
        startOffset: Number,
        endOffset: Number,
        page: Number,
        // where the highlight sits on the PDF page, as fractions (0-1) of the page's width and height
        rects: [{ _id: false, x: Number, y: Number, w: Number, h: Number }],
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
        parentId: Schema.Types.ObjectId, // set on replies: the _id of the comment being answered
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

researchItemSchema.index({ collectionId: 1, createdAt: -1 });
researchItemSchema.index({ collectionId: 1, "source.url": 1 });
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