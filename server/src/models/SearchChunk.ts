import { Schema, model } from "mongoose";

// One searchable piece of the library with its vector: a passage of a clip, a highlight, a comment,
// or a clip's literature-matrix entries.
const searchChunkSchema = new Schema(
  {
    collectionId: { type: Schema.Types.ObjectId, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["clip", "highlight", "comment", "matrix"], required: true },
    refId: { type: Schema.Types.ObjectId, default: null }, // the highlight or comment this chunk is
    idx: { type: Number, default: 0 }, // position among a clip's passages
    text: { type: String, maxlength: 1600, default: "" }, // what is shown as the result snippet
    hash: String, // of what was embedded, so unchanged pieces are not embedded again
    model: String,
    embedding: { type: [Number], select: false }, // skipped by ordinary reads
  },
  { timestamps: true }
);

searchChunkSchema.index({ itemId: 1, kind: 1, refId: 1, idx: 1 }, { unique: true });
searchChunkSchema.index({ collectionId: 1 });

export const SearchChunk = model("SearchChunk", searchChunkSchema);