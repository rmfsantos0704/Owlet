import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ResearchItem } from "../models/ResearchItem.js";
import type { ActivityType } from "../models/Activity.js";
import { recordActivity } from "../services/activityLog.js";

// Put this on a research route, after the limiters and before the controller. When the request succeeds
// (a 2xx answer), it writes one activity row. The controller itself is not touched.
export function trackActivity(type: ActivityType) {
  return (req: Request, res: Response, next: NextFunction) => {
    let body: any;
    const originalJson = res.json.bind(res);
    res.json = ((b: unknown) => {
      body = b;
      return originalJson(b);
    }) as typeof res.json;

    res.on("finish", () => {
      if (res.statusCode >= 300) return; // duplicates (409), validation errors and the like are not activity
      void log(type, req, res.locals.userId, body);
    });
    next();
  };
}

async function log(type: ActivityType, req: Request, userId: string, body: any) {
  try {
    const select = "collectionId source.title source.fileName";
    const fresh = type === "clip_added" || type === "pdf_imported";
    const id = String(req.params.id ?? body?.item?._id ?? body?.item?.id ?? body?.id ?? "");

    let item: any = mongoose.isValidObjectId(id) ? await ResearchItem.findById(id).select(select).lean() : null;
    // a new clip or import whose answer we can't read: use what this person saved in the last minute
    if (!item && fresh) {
      item = await ResearchItem.findOne({ userId, createdAt: { $gte: new Date(Date.now() - 60_000) } })
        .sort({ createdAt: -1 })
        .select(select)
        .lean();
    }
    if (!item?.collectionId) return;

    await recordActivity({
      collectionId: item.collectionId,
      actorId: userId,
      type,
      itemId: item._id,
      itemTitle: item.source?.title || item.source?.fileName || "Untitled",
    });
  } catch (err) {
    console.error("Activity tracking failed:", err);
  }
}