import { Request, Response } from "express";
import mongoose from "mongoose";
import { Activity, NotificationState } from "../models/Activity.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { User } from "../models/User.js";
import { collection } from "../models/Collection.js";
import { roleIn } from "../services/access.js";

// Turns rows into what the dashboard shows. People are looked up here, by id.
async function shape(rows: any[], uid: string, wsNames?: Map<string, string>) {
  const userIds = [...new Set(rows.flatMap((r) => [r.actorId, r.targetUserId]).filter(Boolean).map(String))];
  const itemIds = [...new Set(rows.map((r) => r.itemId).filter(Boolean).map(String))];
  const [users, items] = (await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).select("email").lean() : [],
    itemIds.length ? ResearchItem.find({ _id: { $in: itemIds } }).select("_id").lean() : [],
  ])) as [any[], any[]];

  const email = new Map(users.map((u) => [String(u._id), u.email as string]));
  const alive = new Set(items.map((i) => String(i._id)));
  const who = (id: unknown) => ({ email: email.get(String(id)) ?? null, isYou: String(id) === uid });

  return rows.map((r) => ({
    id: String(r._id),
    type: r.type,
    count: r.count ?? 1,
    createdAt: r.createdAt,
    actor: who(r.actorId),
    target: r.targetUserId ? who(r.targetUserId) : null,
    item: r.itemId
      ? { id: String(r.itemId), title: r.itemTitle ?? "Untitled", exists: alive.has(String(r.itemId)) }
      : null,
    ...(wsNames ? { collection: { id: String(r.collectionId), name: wsNames.get(String(r.collectionId)) ?? "" } } : {}),
  }));
}

// GET /collections/:id/activity : everything that happened in one collection (any member can see it)
export async function listActivity(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const uid = String(res.locals.userId);
  const ws = await collection.findById(id).select("ownerId members");
  if (!ws || !roleIn(ws, uid)) return res.status(404).json({ error: "Not found" });

  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
  const rows = await Activity.find({ collectionId: ws._id }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ activity: await shape(rows, uid) });
}

// GET /collections/notifications : what other people did in the collections I belong to.
// Only activity from after I joined a collection counts, so a new member isn't flooded with its history.
export async function listNotifications(_req: Request, res: Response) {
  const uid = String(res.locals.userId);
  const [collections, state] = await Promise.all([
    collection.find({ $or: [{ ownerId: uid }, { "members.userId": uid }] }).select("name ownerId members createdAt").lean(),
    NotificationState.findOne({ userId: uid }).lean(),
  ]);
  if (!collections.length) return res.json({ unread: 0, notifications: [] });

  const readAt = state?.readAt ?? new Date(0);
  const joinedAt = new Map<string, Date>();
  for (const w of collections as any[]) {
    const mine = String(w.ownerId) === uid ? null : w.members.find((m: any) => String(m.userId) === uid);
    joinedAt.set(String(w._id), new Date(mine?.addedAt ?? w.createdAt ?? 0));
  }

  const since = (floor?: Date) =>
    (collections as any[]).map((w) => {
      const joined = joinedAt.get(String(w._id))!;
      const from = floor && floor > joined ? floor : joined;
      return { collectionId: w._id, createdAt: { $gt: from } };
    });

  const [rows, unread] = await Promise.all([
    Activity.find({ actorId: { $ne: uid }, $or: since() }).sort({ createdAt: -1 }).limit(20).lean(),
    Activity.countDocuments({ actorId: { $ne: uid }, $or: since(readAt) }, { limit: 100 }),
  ]);

  const names = new Map((collections as any[]).map((w) => [String(w._id), w.name as string]));
  const shaped = await shape(rows, uid, names);
  const notifications = shaped.map((n, i) => ({
    ...n,
    unread: new Date(rows[i].createdAt) > readAt && new Date(rows[i].createdAt) > joinedAt.get(String(rows[i].collectionId))!,
  }));
  res.json({ unread, notifications });
}

// POST /collections/notifications/read
export async function markNotificationsRead(_req: Request, res: Response) {
  await NotificationState.updateOne({ userId: res.locals.userId }, { $set: { readAt: new Date() } }, { upsert: true });
  res.json({ ok: true });
}