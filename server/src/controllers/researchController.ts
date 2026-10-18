import { Request, Response } from "express";
import mongoose, { type UpdateQuery } from "mongoose";
import { z } from "zod";
import { ResearchItem } from "../models/ResearchItem.js";
import { Workspace } from "../models/Workspace.js";
import { User } from "../models/User.js";
import { analyzeText } from "../services/groq.js";
import { buildCitations } from "../services/citations.js";
import { streamPdf } from "../services/pdf.js";
import { toBibtex, toCsv } from "../services/export.js";
import { atLeast, ensureDefaultWorkspace, roleIn, workspaceIds } from "../services/access.js";

const clipSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  publishedDate: z.string().max(100).optional(),
  rawText: z.string().min(50).max(200000),
  workspaceId: z.string().optional(),
});
const highlightSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  color: z.enum(["yellow", "green", "blue", "pink"]).default("yellow"),
  note: z.string().trim().max(1000).optional(),
});
const commentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  highlightId: z.string().optional(),
});
const tagsSchema = z.object({
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20),
});

export async function clip(req: Request, res: Response) {
  const parsed = clipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid clip data" });
  const d = parsed.data;
  const userId = res.locals.userId;

  let ws;
  if (d.workspaceId) {
    if (!mongoose.isValidObjectId(d.workspaceId)) return res.status(400).json({ error: "Bad workspace id" });
    ws = await Workspace.findById(d.workspaceId);
    if (!ws || !atLeast(roleIn(ws, userId), "editor")) {
      return res.status(403).json({ error: "You can't add clips to that workspace" });
    }
  } else {
    ws = await ensureDefaultWorkspace(userId);
  }

  const existing = await ResearchItem.findOne({ workspaceId: ws._id, "source.dedupeKey": d.url }).select("_id");
  if (existing) return res.status(409).json({ error: "Already clipped", id: existing.id });

  const domain = new URL(d.url).hostname;

  let ai = { summary: "", paraphrase: "", tags: [] as string[] };
  let aiFailed = false;
  try {
    ai = await analyzeText(d.title, d.rawText, {
      format: ws.aiSettings?.format,
      length: ws.aiSettings?.length,
      instructions: ws.aiSettings?.instructions,
    });
  } catch (err) {
    console.error("Groq failed:", err);
    aiFailed = true; // still save the clip
  }

  const item = await ResearchItem.create({
    userId,
    workspaceId: ws._id,
    source: {
      kind: "web",
      url: d.url,
      dedupeKey: d.url,
      domain,
      title: d.title,
      author: d.author,
      publishedDate: d.publishedDate,
    },
    content: { rawText: d.rawText, wordCount: d.rawText.split(/\s+/).length },
    aiOutput: { summary: ai.summary, paraphrase: ai.paraphrase },
    citations: buildCitations({ author: d.author, title: d.title, url: d.url, domain, publishedDate: d.publishedDate }),
    tags: ai.tags,
  });

  res.status(201).json({ item, aiFailed });
}

async function buildFilter(req: Request, userId: string) {
  const ids = await workspaceIds(userId, "viewer");
  const wid = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const filter: Record<string, unknown> = {
    workspaceId: { $in: wid ? ids.filter((i) => String(i) === wid) : ids },
  };
  if (typeof req.query.tag === "string" && req.query.tag) filter.tags = req.query.tag;
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ "source.title": rx }, { "aiOutput.summary": rx }, { tags: rx }];
  }
  return filter;
}

export async function list(req: Request, res: Response) {
  const items = await ResearchItem.find(await buildFilter(req, res.locals.userId))
    .select("-content.rawText")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ items });
}

export async function getOne(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await workspaceIds(res.locals.userId, "viewer");
  const item = await ResearchItem.findOne({ _id: id, workspaceId: { $in: ids } });
  if (!item) return res.status(404).json({ error: "Not found" });
  const ws = await Workspace.findById(item.workspaceId).select("ownerId members");
  res.json({ item, role: ws ? roleIn(ws, res.locals.userId) : null });
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await workspaceIds(res.locals.userId, "editor");
  const result = await ResearchItem.deleteOne({ _id: id, workspaceId: { $in: ids } });
  if (!result.deletedCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}

// Applies one update to an item the user can edit and returns the arrays that can change.
async function mutate(req: Request, res: Response, update: UpdateQuery<any>, status = 200) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await workspaceIds(res.locals.userId, "editor");
  const item = await ResearchItem.findOneAndUpdate({ _id: id, workspaceId: { $in: ids } }, update, { new: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.status(status).json({ highlights: item.highlights, comments: item.comments, tags: item.tags });
}

export async function addHighlight(req: Request, res: Response) {
  const p = highlightSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid highlight" });
  return mutate(req, res, { $push: { highlights: p.data } }, 201);
}

export async function removeHighlight(req: Request, res: Response) {
  const hid = String(req.params.highlightId);
  if (!mongoose.isValidObjectId(hid)) return res.status(400).json({ error: "Bad id" });
  // also removes comments anchored to this highlight
  return mutate(req, res, { $pull: { highlights: { _id: hid }, comments: { highlightId: hid } } });
}

export async function addComment(req: Request, res: Response) {
  const p = commentSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid comment" });
  const { text, highlightId } = p.data;
  if (highlightId && !mongoose.isValidObjectId(highlightId)) {
    return res.status(400).json({ error: "Bad highlight id" });
  }
  const me = await User.findById(res.locals.userId).select("email");
  return mutate(
    req,
    res,
    { $push: { comments: { userId: res.locals.userId, authorEmail: me?.email, text, highlightId } } },
    201
  );
}

export async function removeComment(req: Request, res: Response) {
  const cid = String(req.params.commentId);
  if (!mongoose.isValidObjectId(cid)) return res.status(400).json({ error: "Bad id" });
  return mutate(req, res, { $pull: { comments: { _id: cid, userId: res.locals.userId } } });
}

export async function setTags(req: Request, res: Response) {
  const p = tagsSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid tags" });
  return mutate(req, res, { $set: { tags: [...new Set(p.data.tags)] } });
}

export async function pdf(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await workspaceIds(res.locals.userId, "viewer");
  const item = await ResearchItem.findOne({ _id: id, workspaceId: { $in: ids } })
    .select("-content.rawText")
    .lean();
  if (!item) return res.status(404).json({ error: "Not found" });
  streamPdf(item, res);
}

export async function exportItems(req: Request, res: Response) {
  const format = String(req.query.format ?? "json");
  if (!["json", "csv", "bibtex"].includes(format)) {
    return res.status(400).json({ error: "format must be json, csv or bibtex" });
  }
  const items = await ResearchItem.find(await buildFilter(req, res.locals.userId))
    .select("-content.rawText")
    .sort({ createdAt: -1 })
    .limit(1000)
    .lean();

  let type = "application/json";
  let ext = "json";
  let body: string;
  if (format === "csv") {
    type = "text/csv"; ext = "csv"; body = toCsv(items);
  } else if (format === "bibtex") {
    type = "application/x-bibtex"; ext = "bib"; body = toBibtex(items);
  } else {
    body = JSON.stringify({ exportedAt: new Date().toISOString(), count: items.length, items }, null, 2);
  }
  res.setHeader("Content-Type", `${type}; charset=utf-8`);
  res.setHeader("Content-Disposition", `attachment; filename="owlet-export.${ext}"`);
  res.send(body);
}