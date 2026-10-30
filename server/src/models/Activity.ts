import { Schema, model } from "mongoose";

export const ACTIVITY_TYPES = [
  "clip_added", "pdf_imported", "highlight_added", "comment_added",
  "member_joined", "member_left", "member_removed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// One row per thing that happened in a collection. No emails or clip text are stored here: people are looked up
// by id when the feed is read, so a deleted account simply shows as "Someone". Rows delete themselves after 90 days.
const activitySchema = new Schema({
  collectionId: { type: Schema.Types.ObjectId, ref: "collection", required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  itemId: { type: Schema.Types.ObjectId },
  itemTitle: { type: String, maxlength: 200 },
  targetUserId: { type: Schema.Types.ObjectId }, // member_removed: who was removed
  count: { type: Number, default: 1 }, // bursts (ten highlights in a row) are merged into one row
  createdAt: { type: Date, default: Date.now },
});
activitySchema.index({ actorId: 1 });
activitySchema.index({ collectionId: 1, createdAt: -1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export const Activity = model("Activity", activitySchema);

// When each person last opened their notifications bell.
const stateSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  readAt: { type: Date, required: true },
});
export const NotificationState = model("NotificationState", stateSchema);