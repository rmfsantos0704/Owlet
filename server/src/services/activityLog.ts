import type { Types } from "mongoose";
import { Activity, type ActivityType } from "../models/Activity.js";

type Id = string | Types.ObjectId;

// Bursts are merged so one busy person doesn't fill everyone's feed: ten highlights on one clip in ten minutes
// become one row ("added 10 highlights"), and a batch of PDF imports becomes one row.
const MERGE: Partial<Record<ActivityType, { windowMs: number; perItem: boolean }>> = {
  highlight_added: { windowMs: 10 * 60 * 1000, perItem: true },
  comment_added: { windowMs: 10 * 60 * 1000, perItem: true },
  pdf_imported: { windowMs: 2 * 60 * 1000, perItem: false },
};

export async function recordActivity(a: {
  collectionId: Id;
  actorId: Id;
  type: ActivityType;
  itemId?: Id;
  itemTitle?: string;
  targetUserId?: Id;
}) {
  // logging must never break the action that triggered it
  try {
    const now = new Date();
    const title = a.itemTitle?.slice(0, 200);
    const rule = MERGE[a.type];
    if (rule) {
      const filter: Record<string, unknown> = {
        collectionId: a.collectionId,
        actorId: a.actorId,
        type: a.type,
        createdAt: { $gte: new Date(now.getTime() - rule.windowMs) },
      };
      if (rule.perItem && a.itemId) filter.itemId = a.itemId;
      const merged = await Activity.findOneAndUpdate(
        filter,
        { $set: { createdAt: now, itemId: a.itemId, itemTitle: title }, $inc: { count: 1 } },
        { sort: { createdAt: -1 } }
      );
      if (merged) return;
    }
    await Activity.create({ ...a, itemTitle: title, createdAt: now });
  } catch (err) {
    console.error("Could not record activity:", err);
  }
}