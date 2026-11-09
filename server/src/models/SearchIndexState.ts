import { Schema, model } from "mongoose";

// When each clip was last indexed. A clip is out of date when it changed after this time.
const searchIndexStateSchema = new Schema({
  itemId: { type: Schema.Types.ObjectId, required: true, unique: true },
  collectionId: { type: Schema.Types.ObjectId, required: true, index: true },
  indexedAt: { type: Date, required: true },
  model: String,
  chunkCount: { type: Number, default: 0 },
});

export const SearchIndexState = model("SearchIndexState", searchIndexStateSchema);