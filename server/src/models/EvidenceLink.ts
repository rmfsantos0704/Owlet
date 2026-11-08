import { Schema, model } from "mongoose";

export const STANCES = ["supports", "challenges", "background", "methodology", "open"] as const;
export type Stance = (typeof STANCES)[number];

// One card on the evidence board: a highlight, a whole clip, or a free note,
// filed under a stance (a column), and optionally tied to one research question.
const evidenceLinkSchema = new Schema(
  {
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "ResearchQuestion", default: null },
    stance: { type: String, enum: STANCES, required: true },
    kind: { type: String, enum: ["highlight", "clip", "note"], required: true },
    itemId: { type: Schema.Types.ObjectId, ref: "ResearchItem", default: null },
    highlightId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
    order: { type: Number, default: 0 }, // position inside its column
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

evidenceLinkSchema.index({ collectionId: 1, stance: 1, order: 1 });
evidenceLinkSchema.index({ collectionId: 1, questionId: 1 });
evidenceLinkSchema.index({ itemId: 1 });
// the same source material can be on a question only once (notes have no itemId, so they're exempt)
evidenceLinkSchema.index(
  { collectionId: 1, questionId: 1, itemId: 1, highlightId: 1 },
  { unique: true, partialFilterExpression: { itemId: { $type: "objectId" } } }
);

export const EvidenceLink = model("EvidenceLink", evidenceLinkSchema);