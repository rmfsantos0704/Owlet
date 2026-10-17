import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ResearchItem } from "../models/ResearchItem.js";
import { analyzeText } from "../services/groq.js";
import { buildCitations } from "../services/citations.js";

const clipSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  publishedDate: z.string().max(100).optional(),
  rawText: z.string().min(50).max(200000),
  projectId: z.string().optional(),
});

export async function clip(req: Request, res: Response) {
  const parsed = clipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid clip data" });
  const d = parsed.data;

  const userId = res.locals.userId;
  const existing = await ResearchItem.findOne({ userId, "source.url": d.url }).select("_id");
  if (existing) return res.status(409).json({ error: "Already clipped", id: existing.id });

  const domain = new URL(d.url).hostname;

  let ai = { summary: "", paraphrase: "", tags: [] as string[] };
  let aiFailed = false;
  try {
    ai = await analyzeText(d.title, d.rawText);
  } catch (err) {
    console.error("Groq failed:", err);
    aiFailed = true; // still save the clip
  }

  const item = await ResearchItem.create({
    userId,
    projectId: d.projectId && mongoose.isValidObjectId(d.projectId) ? d.projectId : null,
    source: { url: d.url, domain, title: d.title, author: d.author, publishedDate: d.publishedDate },
    content: { rawText: d.rawText, wordCount: d.rawText.split(/\s+/).length },
    aiOutput: { summary: ai.summary, paraphrase: ai.paraphrase },
    citations: buildCitations({ author: d.author, title: d.title, url: d.url, domain, publishedDate: d.publishedDate }),
    tags: ai.tags,
  });

  res.status(201).json({ item, aiFailed });
}

export async function list(req: Request, res: Response) {
  const filter: Record<string, unknown> = { userId: res.locals.userId };
  if (typeof req.query.tag === "string") filter.tags = req.query.tag;
  if (typeof req.query.projectId === "string") filter.projectId = req.query.projectId;
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const rx = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ "source.title": rx }, { "aiOutput.summary": rx }, { tags: rx }];
  }
  const items = await ResearchItem.find(filter)
    .select("-content.rawText")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ items });
}

export async function getOne(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const item = await ResearchItem.findOne({ _id: id, userId: res.locals.userId });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ item });
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const result = await ResearchItem.deleteOne({ _id: id, userId: res.locals.userId });
  if (!result.deletedCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}