import { Schema, model } from "mongoose";
import { BRIEF_TEMPLATE_IDS } from "../services/briefTemplates.js";

// where a claim comes from: a passage of the source's text, one of the researcher's highlights, or a matrix cell
const citationSchema = new Schema(
  {
    source: Number, // 1-based position in the brief's source list
    itemId: { type: Schema.Types.ObjectId, ref: "ResearchItem" },
    highlightId: { type: Schema.Types.ObjectId, default: null },
    kind: { type: String, enum: ["text", "highlight", "matrix"], default: "text" },
    quote: { type: String, maxlength: 600 },
    verified: { type: Boolean, default: false }, // the quote was found word for word in the source
  },
  { _id: false }
);

const blockSchema = new Schema({
  text: { type: String, maxlength: 4000, default: "" },
  citations: [citationSchema],
  edited: { type: Boolean, default: false }, // the researcher changed the generated wording
});

const sectionSchema = new Schema({
  title: { type: String, maxlength: 400, default: "" },
  blocks: [blockSchema],
});

const briefSchema = new Schema(
  {
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, trim: true, maxlength: 120, required: true },
    template: { type: String, enum: BRIEF_TEMPLATE_IDS, required: true },
    question: { type: String, trim: true, maxlength: 300, default: "" },
    status: { type: String, enum: ["draft", "ready"], default: "draft" },
    sources: [
      {
        _id: false,
        itemId: { type: Schema.Types.ObjectId, ref: "ResearchItem" },
        title: String,
        reference: String, // the APA citation, used for the reference list
      },
    ],
    sections: [sectionSchema],
    wordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

briefSchema.index({ collectionId: 1, updatedAt: -1 });

export const Brief = model("Brief", briefSchema);