import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { User } from "../models/User.js";
import { Invitation } from "../models/Invitation.js";
import { AiSession } from "../models/AiSession.js";
import {
  DECLINE_COOLDOWN_MS, INVITE_TTL_MS, MAX_MEMBERS, MAX_PENDING_PER_USER, MAX_PENDING_PER_collection,
} from "../services/invitations.js";
import { atLeast, ensureDefaultcollection, roleIn, type Role } from "../services/access.js";
import { analyzeText } from "../services/groq.js";
import { publicLink } from "./joinLinkController.js";
import { Activity } from "../models/Activity.js";
import { recordActivity } from "../services/activityLog.js";
import { streamcollectionPdf } from "../services/collectionPdf.js";
import { Writable } from "node:stream";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  aiSettings: z
    .object({
      format: z.enum(["paragraph", "bullets", "academic", "simple"]),
      length: z.enum(["short", "medium", "detailed"]),
      instructions: z.string().trim().max(500),
    })
    .partial()
    .optional(),
});
const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["editor", "viewer"]),
});
const roleSchema = z.object({ role: z.enum(["editor", "viewer"]) });
const mergeSchema = z.object({ targetId: z.string() });

function summary(w: any, role: Role) {
  return {
    id: w.id,
    name: w.name,
    description: w.description ?? "",
    isDefault: w.isDefault,
    role,
    memberCount: w.members.length + 1,
    aiSettings: {
      format: w.aiSettings?.format ?? "paragraph",
      length: w.aiSettings?.length ?? "medium",
      instructions: w.aiSettings?.instructions ?? "",
    },
  };
}

// loads the collection and the caller's role; answers 404 for non-members
async function load(req: Request, res: Response) {
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
  return { ws, role };
}

export async function listcollections(_req: Request, res: Response) {
  const uid = res.locals.userId;
  await ensureDefaultcollection(uid);
  const all = await collection.find({ $or: [{ ownerId: uid }, { "members.userId": uid }] }).sort({
    isDefault: -1,
    createdAt: 1,
  });
  res.json({ collections: all.map((w) => summary(w, roleIn(w, uid) as Role)) });
}

export async function createcollection(req: Request, res: Response) {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "A name (1-80 characters) is required" });
  const uid = res.locals.userId;
  if ((await collection.countDocuments({ ownerId: uid })) >= 20) {
    return res.status(400).json({ error: "You can own up to 20 collections" });
  }
  const ws = await collection.create({ name: p.data.name, description: p.data.description, ownerId: uid });
  res.status(201).json({ collection: summary(ws, "owner") });
}

export async function getcollection(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  const { ws, role } = found;
  const users = await User.find({ _id: { $in: [ws.ownerId, ...ws.members.map((m) => m.userId)] } }).select("email");
  const email = (id: unknown) => users.find((u) => String(u._id) === String(id))?.email ?? "unknown";
  res.json({
    collection: {
      ...summary(ws, role),
      owner: { id: String(ws.ownerId), email: email(ws.ownerId) },
      members: ws.members.map((m) => ({ userId: String(m.userId), email: email(m.userId), role: m.role })),
      joinLink: role === "owner" ? publicLink(ws) : undefined,
    },
  });
}

export async function updatecollection(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can change settings" });
  const p = updateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid settings" });

  const $set: Record<string, unknown> = {};
  if (p.data.name !== undefined) $set.name = p.data.name;
  if (p.data.description !== undefined) $set.description = p.data.description;
  for (const [k, v] of Object.entries(p.data.aiSettings ?? {})) $set[`aiSettings.${k}`] = v;

  const ws = await collection.findByIdAndUpdate(found.ws._id, { $set }, { new: true, runValidators: true });
  if (!ws) return res.status(404).json({ error: "Not found" });
  res.json({ collection: summary(ws, "owner") });
}

export async function deletecollection(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can delete a collection" });
  if (found.ws.isDefault) return res.status(400).json({ error: "Your Personal collection can't be deleted" });
  await ResearchItem.deleteMany({ collectionId: found.ws._id });
  await Invitation.deleteMany({ collectionId: found.ws._id });
  await Activity.deleteMany({ collectionId: found.ws._id });
  await AiSession.deleteMany({ collectionId: found.ws._id });
  await collection.deleteOne({ _id: found.ws._id });
  res.json({ ok: true });
}

// Moves every clip from this collection into another one, then deletes this collection.
// Clips the target already holds (same page or same PDF) are skipped, not copied twice.
// Only the owner can do it (and not for Personal), and they need to be an owner or editor of the target.
export async function mergeCollection(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can merge a collection into another" });
  if (found.ws.isDefault) return res.status(400).json({ error: "Your Personal collection can't be merged away" });

  const p = mergeSchema.safeParse(req.body);
  if (!p.success || !mongoose.isValidObjectId(p.data.targetId)) return res.status(400).json({ error: "Bad collection id" });
  if (String(found.ws._id) === p.data.targetId) {
    return res.status(400).json({ error: "Pick a different collection to merge into" });
  }

  const target = await collection.findById(p.data.targetId);
  if (!target || !atLeast(roleIn(target, res.locals.userId), "editor")) {
    return res.status(403).json({ error: "You can't add clips to that collection" });
  }

  try {
    const targetKeys = await ResearchItem.distinct("source.dedupeKey", { collectionId: target._id });
    const moved = await ResearchItem.updateMany(
      { collectionId: found.ws._id, "source.dedupeKey": { $nin: targetKeys } },
      { $set: { collectionId: target._id } }
    );
    // whatever is still here is a duplicate of something the target already holds
    const skipped = await ResearchItem.deleteMany({ collectionId: found.ws._id });

    // AI sessions are private to whoever ran them: keep the ones whose owner can open the target, drop the rest
    const canOpenTarget = [target.ownerId, ...target.members.map((m: any) => m.userId)];
    await AiSession.updateMany(
      { collectionId: found.ws._id, userId: { $in: canOpenTarget } },
      { $set: { collectionId: target._id } }
    );
    await AiSession.deleteMany({ collectionId: found.ws._id });
    await Invitation.deleteMany({ collectionId: found.ws._id });
    await Activity.deleteMany({ collectionId: found.ws._id });
    await collection.deleteOne({ _id: found.ws._id });

    res.json({ ok: true, moved: moved.modifiedCount, skipped: skipped.deletedCount, targetId: String(target._id) });
  } catch (err) {
    console.error("Merge failed:", err);
    res.status(500).json({ error: "The merge failed part-way. Check both collections, then try again." });
  }
}

// Sends an invitation. Nobody joins until they accept it, and no email is sent (it shows up in their Owlet).
export async function addMember(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can invite members" });
  const p = addMemberSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "A valid email and role are required" });

  const user = await User.findOne({ email: p.data.email });
  if (!user) return res.status(404).json({ error: "No Owlet account uses that email. Ask them to sign up first." });
  if (String(user._id) === String(found.ws.ownerId)) return res.status(400).json({ error: "That's the owner" });
  if (found.ws.members.some((m) => String(m.userId) === String(user._id))) {
    return res.status(409).json({ error: "Already a member" });
  }

  const now = new Date();
  const live = { status: "pending" as const, expiresAt: { $gt: now } };
  const [pendingHere, pendingForThem, existing] = await Promise.all([
    Invitation.countDocuments({ collectionId: found.ws._id, ...live }),
    Invitation.countDocuments({ inviteeId: user._id, ...live }),
    Invitation.findOne({ collectionId: found.ws._id, inviteeId: user._id }),
  ]);

  if (existing?.status === "pending" && existing.expiresAt > now) {
    return res.status(409).json({ error: "That person already has an open invitation. Wait for their answer." });
  }
  if (pendingHere >= MAX_PENDING_PER_collection) {
    return res.status(429).json({ error: "Too many open invitations. Wait for answers or cancel some first." });
  }
  if (found.ws.members.length + pendingHere >= MAX_MEMBERS) {
    return res.status(400).json({ error: "Member limit reached (open invitations count toward it)" });
  }
  // Same message for "declined recently" and "inbox full", so the inviter learns nothing about the person's choices.
  const declinedRecently =
    existing?.status === "declined" &&
    existing.respondedAt &&
    now.getTime() - existing.respondedAt.getTime() < DECLINE_COOLDOWN_MS;
  if (declinedRecently || pendingForThem >= MAX_PENDING_PER_USER) {
    return res.status(409).json({ error: "That person can't be invited right now. Try again later." });
  }

  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  try {
    if (existing) {
      const r = await Invitation.updateOne(
        { _id: existing._id, status: existing.status },
        { $set: { inviterId: res.locals.userId, role: p.data.role, status: "pending", expiresAt }, $unset: { respondedAt: "" } }
      );
      if (!r.matchedCount) return res.status(409).json({ error: "That person already has an open invitation." });
    } else {
      await Invitation.create({
        collectionId: found.ws._id,
        inviterId: res.locals.userId,
        inviteeId: user._id,
        role: p.data.role,
        expiresAt,
      });
    }
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return res.status(409).json({ error: "That person already has an open invitation." });
    }
    throw err;
  }
  res.status(201).json({ ok: true, invited: true });
}

// Owner view: invitations that are still waiting for an answer.
export async function listInvitations(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can see invitations" });
  const invs = await Invitation.find({ collectionId: found.ws._id, status: "pending", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  const users = invs.length
    ? await User.find({ _id: { $in: invs.map((i) => i.inviteeId) } }).select("email").lean()
    : [];
  res.json({
    invitations: invs.map((i) => ({
      id: String(i._id),
      email: users.find((u) => String(u._id) === String(i.inviteeId))?.email ?? "unknown",
      role: i.role,
      expiresAt: i.expiresAt,
    })),
  });
}

export async function cancelInvitation(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can cancel invitations" });
  const invId = String(req.params.invId);
  if (!mongoose.isValidObjectId(invId)) return res.status(400).json({ error: "Bad id" });
  await Invitation.deleteOne({ _id: invId, collectionId: found.ws._id, status: "pending" });
  res.json({ ok: true });
}

export async function setMemberRole(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can change roles" });
  const uid = String(req.params.userId);
  const p = roleSchema.safeParse(req.body);
  if (!p.success || !mongoose.isValidObjectId(uid)) return res.status(400).json({ error: "Invalid request" });

  const r = await collection.updateOne(
    { _id: found.ws._id, "members.userId": new mongoose.Types.ObjectId(uid) },
    { $set: { "members.$.role": p.data.role } }
  );
  if (!r.matchedCount) return res.status(404).json({ error: "Member not found" });
  res.json({ ok: true });
}

export async function removeMember(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  // "me" stands for the signed-in person, so the sidebar's Leave option doesn't need to know its own id
  const target = req.params.userId === "me" ? String(res.locals.userId) : String(req.params.userId);
  if (!mongoose.isValidObjectId(target)) return res.status(400).json({ error: "Bad id" });
  // the owner can remove anyone; members can remove only themselves (leave)
  if (found.role !== "owner" && target !== String(res.locals.userId)) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const wasMember = found.ws.members.some((m) => String(m.userId) === target);
  await collection.updateOne(
    { _id: found.ws._id },
    { $pull: { members: { userId: new mongoose.Types.ObjectId(target) } } }
  );
  if (wasMember) {
    const leaving = target === String(res.locals.userId);
    await recordActivity({
      collectionId: found.ws._id,
      actorId: res.locals.userId,
      type: leaving ? "member_left" : "member_removed",
      targetUserId: leaving ? undefined : target,
    });
  }
  res.json({ ok: true });
}
const testSchema = z.object({
  aiSettings: z.object({
    format: z.enum(["paragraph", "bullets", "academic", "simple"]),
    length: z.enum(["short", "medium", "detailed"]),
    instructions: z.string().trim().max(500),
  }),
  itemId: z.string().optional(),
});

const SAMPLE_TITLE = "How Sleep Affects Memory";
const SAMPLE_TEXT =
  "Sleep plays a critical role in memory consolidation. In a 2023 study of 120 university students, those who slept at least seven hours after studying scored 18% higher on recall tests than students who stayed awake. The researchers argue that during deep sleep the brain replays recent experiences and strengthens the neural connections that store them. REM sleep, they add, supports creative problem solving and emotional regulation. The study had limits: participants were all aged 18 to 24, sleep was self-reported rather than measured, and the effect was weaker for complex tasks than for simple fact recall. The authors recommend that students protect sleep during exam periods instead of studying through the night, and call for larger studies across more age groups.";

// Runs the given (possibly unsaved) AI settings on sample text or one of the collection's clips. Saves nothing.
export async function testAi(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can test settings" });
  const p = testSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid settings" });

  let title = SAMPLE_TITLE;
  let text = SAMPLE_TEXT;
  let source = "the built-in sample article";

  if (p.data.itemId) {
    if (!mongoose.isValidObjectId(p.data.itemId)) return res.status(400).json({ error: "Bad clip id" });
    const item = await ResearchItem.findOne({ _id: p.data.itemId, collectionId: found.ws._id }).select(
      "source.title source.kind content.rawText"
    );
    const raw = item?.content?.rawText ?? "";
    if (!item || raw.length < 50) return res.status(404).json({ error: "Clip not found in this collection" });
    title = item.source?.title ?? "Untitled";
    // same text preparation as a real import: PDFs send the start and the end
    text = item.source?.kind === "pdf" && raw.length > 12000 ? raw.slice(0, 8000) + "\n[...]\n" + raw.slice(-4000) : raw;
    source = `"${title}"`;
  }

  try {
    const ai = await analyzeText(title, text, p.data.aiSettings);
    res.json({ summary: ai.summary, paraphrase: ai.paraphrase, tags: ai.tags, source });
  } catch (err) {
    console.error("Groq test failed:", err);
    res.status(502).json({
      error: "The AI service failed. If your instructions ask for a different output format, try removing that part.",
    });
  }
}
const EXPORT_LIMIT = 500;

export async function exportPdf(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  const mode = req.query.mode === "citations" ? "citations" : "full";

  const [items, total] = await Promise.all([
    ResearchItem.find({ collectionId: found.ws._id })
      .select("-content.rawText")
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT)
      .lean(),
    ResearchItem.countDocuments({ collectionId: found.ws._id }),
  ]);
  if (!items.length) return res.status(400).json({ error: "This collection has no clips to export yet" });

  // Build the PDF in memory and send it inside JSON. Download managers and PDF extensions
  // intercept raw application/pdf responses, which can cancel the browser's own request.
  const chunks: Buffer[] = [];
  const sink: any = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  sink.setHeader = () => {}; // the generator sets file headers; not needed here
  const finished = new Promise<void>((resolve, reject) => {
    sink.on("finish", resolve);
    sink.on("error", reject);
  });

  streamcollectionPdf(
    { name: found.ws.name, description: found.ws.description ?? "" },
    items,
    mode,
    total - items.length,
    sink as Response
  );
  await finished;

  res.json({ pdf: Buffer.concat(chunks).toString("base64") });
}