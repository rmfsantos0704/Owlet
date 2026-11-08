import { Schema, model } from "mongoose";

// The questions a collection is trying to answer: one main question plus supporting ones.
const researchQuestionSchema = new Schema(
  {
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection", required: true, index: true },
    kind: { type: String, enum: ["main", "supporting"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// at most one main question per collection
researchQuestionSchema.index(
  { collectionId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: "main" } }
);

export const ResearchQuestion = model("ResearchQuestion", researchQuestionSchema);