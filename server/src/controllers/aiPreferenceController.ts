import type { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { SearchChunk } from "../models/SearchChunk.js";
import { SearchIndexState } from "../models/SearchIndexState.js";

// The person's own switch for AI features. The answer uses `enabled`, not `aiEnabled`, on purpose:
// the dashboard's api() helper treats any response with an `aiEnabled` field as a change in AI availability.

export async function getAiPreference(_req: Request, res: Response) {
  const user = await User.findById(res.locals.userId).select("aiOptOut").lean();
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ enabled: !user.aiOptOut });
}

export async function setAiPreference(req: Request, res: Response) {
  const p = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Choose on or off." });
  const userId = String(res.locals.userId);

  await User.updateOne({ _id: userId }, { $set: { aiOptOut: !p.data.enabled } });

  if (!p.data.enabled) {
    // what they made leaves the concept-search index right away: their clips, and their comments on others' clips
    const mine = await ResearchItem.find({ userId }).distinct("_id");
    if (mine.length) {
      await Promise.all([
        SearchChunk.deleteMany({ itemId: { $in: mine } }),
        SearchIndexState.deleteMany({ itemId: { $in: mine } }),
      ]);
    }
    const withMyComments: any[] = await ResearchItem.find({ "comments.userId": userId }).select("comments._id comments.userId").lean();
    const myCommentIds = withMyComments.flatMap((item) =>
      (item.comments ?? []).filter((c: any) => String(c.userId) === userId).map((c: any) => c._id)
    );
    if (myCommentIds.length) await SearchChunk.deleteMany({ kind: "comment", refId: { $in: myCommentIds } });
  }

  res.json({ enabled: p.data.enabled });
}