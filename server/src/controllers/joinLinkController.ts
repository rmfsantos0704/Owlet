import { Request, Response } from "express";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { collection } from "../models/Collection.js";
import { Invitation } from "../models/Invitation.js";
import { User } from "../models/User.js";
import { roleIn } from "../services/access.js";
import { MAX_MEMBERS } from "../services/invitations.js";
import { recordActivity } from "../services/activityLog.js";

const GONE = "This link isn't valid anymore. Ask the owner for a new one.";

const createSchema = z.object({
  role: z.enum(["editor", "viewer"]).default("viewer"),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
  maxUses: z.number().int().min(1).max(MAX_MEMBERS).nullable().default(null),
});

const validToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

// what the owner sees: the link settings, never anyone else's data
export function publicLink(ws: { joinLink?: any }) {
  const l = ws.joinLink;
  if (!l?.token) return null;
  return {
    token: l.token,
    role: l.role as "editor" | "viewer",
    expiresAt: l.expiresAt as Date,
    maxUses: (l.maxUses ?? null) as number | null,
    uses: (l.uses ?? 0) as number,
    expired: !l.expiresAt || l.expiresAt <= new Date(),
  };
}

async function loadOwned(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Bad id" });
    return null;
  }
  const ws = await collection.findById(id);
  const role = ws ? roleIn(ws, res.locals.userId) : null;
  if (!ws || !role) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (role !== "owner") {
    res.status(403).json({ error: "Only the owner can manage the join link" });
    return null;
  }
  return ws;
}

// Create a link, or replace the current one (the old link stops working immediately).
export async function createJoinLink(req: Request, res: Response) {
  const ws = await loadOwned(req, res);
  if (!ws) return;
  if (ws.isDefault) return res.status(400).json({ error: "Your Personal collection can't be shared" });
  const p = createSchema.safeParse(req.body ?? {});
  if (!p.success) return res.status(400).json({ error: "Invalid link settings" });

  const now = new Date();
  const link = {
    token: crypto.randomBytes(32).toString("base64url"), // 43 chars, 256 bits
    role: p.data.role,
    expiresAt: new Date(now.getTime() + p.data.expiresInDays * 86_400_000),
    maxUses: p.data.maxUses,
    uses: 0,
    createdAt: now,
  };
  await collection.updateOne({ _id: ws._id }, { $set: { joinLink: link } });
  res.status(201).json({ joinLink: publicLink({ joinLink: link }) });
}

export async function revokeJoinLink(req: Request, res: Response) {
  const ws = await loadOwned(req, res);
  if (!ws) return;
  await collection.updateOne({ _id: ws._id }, { $unset: { joinLink: "" } });
  res.json({ ok: true });
}

// Finds the collection behind a token if the link is still usable. Every failure looks the same.
async function findByToken(token: string) {
  if (!validToken(token)) return null;
  const ws = await collection.findOne({ "joinLink.token": token });
  const l = ws?.joinLink;
  if (!ws || !l?.token || !l.expiresAt || l.expiresAt <= new Date()) return null;
  if (l.maxUses != null && (l.uses ?? 0) >= l.maxUses) return null;
  return ws;
}

// "Join this collection?" screen. Reads only; nobody is added here.
export async function previewJoin(req: Request, res: Response) {
  const ws = await findByToken(String(req.params.token));
  if (!ws) return res.status(404).json({ error: GONE });
  const owner = await User.findById(ws.ownerId).select("email").lean();
  res.json({
    collection: { name: ws.name, description: ws.description ?? "" },
    ownerEmail: owner?.email ?? "the owner",
    role: ws.joinLink!.role,
    alreadyMember: !!roleIn(ws, res.locals.userId),
    collectionId: String(ws._id),
  });
}

// The confirmation: this is the moment the person becomes a member.
export async function confirmJoin(req: Request, res: Response) {
  const token = String(req.params.token);
  const uid = new mongoose.Types.ObjectId(String(res.locals.userId));
  const ws = await findByToken(token);
  if (!ws) return res.status(404).json({ error: GONE });

  if (roleIn(ws, String(uid))) return res.json({ ok: true, collectionId: String(ws._id), already: true });

  const now = new Date();
  const pending = await Invitation.countDocuments({ collectionId: ws._id, status: "pending", expiresAt: { $gt: now } });
  const room = MAX_MEMBERS - pending;

  // One atomic step: the link must still be valid, have uses left, and the collection must have room.
  // Matching the role too means a link regenerated a moment ago can't hand out the old role.
  const added = await collection.findOneAndUpdate(
    {
      _id: ws._id,
      "joinLink.token": token,
      "joinLink.role": ws.joinLink!.role,
      "joinLink.expiresAt": { $gt: now },
      ownerId: { $ne: uid },
      "members.userId": { $ne: uid },
      $and: [
        { $or: [{ "joinLink.maxUses": null }, { $expr: { $lt: ["$joinLink.uses", "$joinLink.maxUses"] } }] },
        { $expr: { $lt: [{ $size: "$members" }, room] } },
      ],
    },
    { $push: { members: { userId: uid, role: ws.joinLink!.role } }, $inc: { "joinLink.uses": 1 } },
    { new: true }
  );

  if (!added) {
    const fresh = await collection.findById(ws._id);
    if (fresh && roleIn(fresh, String(uid))) return res.json({ ok: true, collectionId: String(ws._id), already: true });
    if (fresh && fresh.members.length >= room) {
      return res.status(409).json({ error: "This collection is full, so you can't join it right now." });
    }
    return res.status(404).json({ error: GONE });
  }

  // a pending invitation to the same collection is now moot
  await Invitation.updateOne(
    { collectionId: ws._id, inviteeId: uid, status: "pending" },
    { $set: { status: "accepted", respondedAt: now } }
  );
  await recordActivity({ collectionId: ws._id, actorId: uid, type: "member_joined" });
  res.json({ ok: true, collectionId: String(ws._id) });
}