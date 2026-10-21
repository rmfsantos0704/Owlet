import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Workspace } from "../models/Workspace.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { User } from "../models/User.js";
import { ensureDefaultWorkspace, roleIn, type Role } from "../services/access.js";
import { analyzeText } from "../services/groq.js";
import { streamWorkspacePdf } from "../services/workspacePdf.js";
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

// loads the workspace and the caller's role; answers 404 for non-members
async function load(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Bad id" });
    return null;
  }
  const ws = await Workspace.findById(id);
  const role = ws ? roleIn(ws, res.locals.userId) : null;
  if (!ws || !role) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return { ws, role };
}

export async function listWorkspaces(_req: Request, res: Response) {
  const uid = res.locals.userId;
  await ensureDefaultWorkspace(uid);
  const all = await Workspace.find({ $or: [{ ownerId: uid }, { "members.userId": uid }] }).sort({
    isDefault: -1,
    createdAt: 1,
  });
  res.json({ workspaces: all.map((w) => summary(w, roleIn(w, uid) as Role)) });
}

export async function createWorkspace(req: Request, res: Response) {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "A name (1-80 characters) is required" });
  const uid = res.locals.userId;
  if ((await Workspace.countDocuments({ ownerId: uid })) >= 20) {
    return res.status(400).json({ error: "You can own up to 20 workspaces" });
  }
  const ws = await Workspace.create({ name: p.data.name, description: p.data.description, ownerId: uid });
  res.status(201).json({ workspace: summary(ws, "owner") });
}

export async function getWorkspace(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  const { ws, role } = found;
  const users = await User.find({ _id: { $in: [ws.ownerId, ...ws.members.map((m) => m.userId)] } }).select("email");
  const email = (id: unknown) => users.find((u) => String(u._id) === String(id))?.email ?? "unknown";
  res.json({
    workspace: {
      ...summary(ws, role),
      owner: { id: String(ws.ownerId), email: email(ws.ownerId) },
      members: ws.members.map((m) => ({ userId: String(m.userId), email: email(m.userId), role: m.role })),
    },
  });
}

export async function updateWorkspace(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can change settings" });
  const p = updateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid settings" });

  const $set: Record<string, unknown> = {};
  if (p.data.name !== undefined) $set.name = p.data.name;
  if (p.data.description !== undefined) $set.description = p.data.description;
  for (const [k, v] of Object.entries(p.data.aiSettings ?? {})) $set[`aiSettings.${k}`] = v;

  const ws = await Workspace.findByIdAndUpdate(found.ws._id, { $set }, { new: true, runValidators: true });
  if (!ws) return res.status(404).json({ error: "Not found" });
  res.json({ workspace: summary(ws, "owner") });
}

export async function deleteWorkspace(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can delete a workspace" });
  if (found.ws.isDefault) return res.status(400).json({ error: "Your Personal workspace can't be deleted" });
  await ResearchItem.deleteMany({ workspaceId: found.ws._id });
  await Workspace.deleteOne({ _id: found.ws._id });
  res.json({ ok: true });
}

export async function addMember(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can add members" });
  const p = addMemberSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "A valid email and role are required" });

  const user = await User.findOne({ email: p.data.email });
  if (!user) return res.status(404).json({ error: "No Owlet account uses that email. Ask them to sign up first." });
  if (String(user._id) === String(found.ws.ownerId)) return res.status(400).json({ error: "That's the owner" });
  if (found.ws.members.length >= 50) return res.status(400).json({ error: "Member limit reached" });

  const r = await Workspace.updateOne(
    { _id: found.ws._id, "members.userId": { $ne: user._id } },
    { $push: { members: { userId: user._id, role: p.data.role } } }
  );
  if (!r.modifiedCount) return res.status(409).json({ error: "Already a member" });
  res.status(201).json({ ok: true });
}

export async function setMemberRole(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  if (found.role !== "owner") return res.status(403).json({ error: "Only the owner can change roles" });
  const uid = String(req.params.userId);
  const p = roleSchema.safeParse(req.body);
  if (!p.success || !mongoose.isValidObjectId(uid)) return res.status(400).json({ error: "Invalid request" });

  const r = await Workspace.updateOne(
    { _id: found.ws._id, "members.userId": new mongoose.Types.ObjectId(uid) },
    { $set: { "members.$.role": p.data.role } }
  );
  if (!r.matchedCount) return res.status(404).json({ error: "Member not found" });
  res.json({ ok: true });
}

export async function removeMember(req: Request, res: Response) {
  const found = await load(req, res);
  if (!found) return;
  const target = String(req.params.userId);
  if (!mongoose.isValidObjectId(target)) return res.status(400).json({ error: "Bad id" });
  // the owner can remove anyone; members can remove only themselves (leave)
  if (found.role !== "owner" && target !== String(res.locals.userId)) {
    return res.status(403).json({ error: "Not allowed" });
  }
  await Workspace.updateOne(
    { _id: found.ws._id },
    { $pull: { members: { userId: new mongoose.Types.ObjectId(target) } } }
  );
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

// Runs the given (possibly unsaved) AI settings on sample text or one of the workspace's clips. Saves nothing.
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
    const item = await ResearchItem.findOne({ _id: p.data.itemId, workspaceId: found.ws._id }).select(
      "source.title source.kind content.rawText"
    );
    const raw = item?.content?.rawText ?? "";
    if (!item || raw.length < 50) return res.status(404).json({ error: "Clip not found in this workspace" });
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
    ResearchItem.find({ workspaceId: found.ws._id })
      .select("-content.rawText")
      .sort({ createdAt: -1 })
      .limit(EXPORT_LIMIT)
      .lean(),
    ResearchItem.countDocuments({ workspaceId: found.ws._id }),
  ]);
  if (!items.length) return res.status(400).json({ error: "This workspace has no clips to export yet" });

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

  streamWorkspacePdf(
    { name: found.ws.name, description: found.ws.description ?? "" },
    items,
    mode,
    total - items.length,
    sink as Response
  );
  await finished;

  res.json({ pdf: Buffer.concat(chunks).toString("base64") });
}