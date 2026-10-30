import { Request, Response } from "express";
import mongoose from "mongoose";
import { Invitation } from "../models/Invitation.js";
import { collection } from "../models/Collection.js";
import { User } from "../models/User.js";
import { roleIn } from "../services/access.js";
import { MAX_MEMBERS } from "../services/invitations.js";
import { recordActivity } from "../services/activityLog.js";

const GONE = "This invitation is no longer available.";

// The signed-in person's open invitations (not expired, collection still exists).
export async function listMine(_req: Request, res: Response) {
  const uid = res.locals.userId;
  const invs = await Invitation.find({ inviteeId: uid, status: "pending", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  if (!invs.length) return res.json({ invitations: [] });

  const [collections, inviters] = await Promise.all([
    collection.find({ _id: { $in: invs.map((i) => i.collectionId) } }).select("name description").lean(),
    User.find({ _id: { $in: invs.map((i) => i.inviterId) } }).select("email").lean(),
  ]);

  const invitations = invs.flatMap((i) => {
    const ws = collections.find((w) => String(w._id) === String(i.collectionId));
    if (!ws) return [];
    return [
      {
        id: String(i._id),
        role: i.role,
        expiresAt: i.expiresAt,
        invitedBy: inviters.find((u) => String(u._id) === String(i.inviterId))?.email ?? "Someone",
        collection: { id: String(ws._id), name: ws.name, description: ws.description ?? "" },
      },
    ];
  });
  res.json({ invitations });
}

export async function accept(req: Request, res: Response) {
  const id = String(req.params.invId);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const uid = new mongoose.Types.ObjectId(String(res.locals.userId));
  const now = new Date();

  const inv = await Invitation.findOne({ _id: id, inviteeId: uid, status: "pending", expiresAt: { $gt: now } });
  if (!inv) return res.status(404).json({ error: GONE });

  const ws = await collection.findById(inv.collectionId);
  if (!ws) {
    await Invitation.deleteOne({ _id: inv._id });
    return res.status(404).json({ error: GONE });
  }

  const close = () =>
    Invitation.updateOne({ _id: inv._id, status: "pending" }, { $set: { status: "accepted", respondedAt: now } });

  // already in (e.g. became the owner through a transfer): just close the invitation
  if (roleIn(ws, String(uid))) {
    await close();
    return res.json({ ok: true, collectionId: String(ws._id) });
  }

  // one atomic step: only if they aren't in yet and there is still room
  const added = await collection.findOneAndUpdate(
    {
      _id: ws._id,
      ownerId: { $ne: uid },
      "members.userId": { $ne: uid },
      $expr: { $lt: [{ $size: "$members" }, MAX_MEMBERS] },
    },
    { $push: { members: { userId: uid, role: inv.role } } },
    { new: true }
  );

  if (!added) {
    // a parallel click may have added them a moment ago; otherwise the collection is full
    const fresh = await collection.findById(ws._id);
    if (fresh && roleIn(fresh, String(uid))) {
      await close();
      return res.json({ ok: true, collectionId: String(ws._id) });
    }
    return res.status(409).json({ error: "This collection is full, so you can't join it right now." });
  }

  await close();
  await recordActivity({ collectionId: ws._id, actorId: uid, type: "member_joined" });
  res.json({ ok: true, collectionId: String(ws._id) });
}

export async function decline(req: Request, res: Response) {
  const id = String(req.params.invId);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const r = await Invitation.findOneAndUpdate(
    { _id: id, inviteeId: res.locals.userId, status: "pending" },
    { $set: { status: "declined", respondedAt: new Date() } }
  );
  if (!r) return res.status(404).json({ error: GONE });
  res.json({ ok: true });
}