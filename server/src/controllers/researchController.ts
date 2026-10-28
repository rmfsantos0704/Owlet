import { createHash } from "node:crypto";
import { Request, Response } from "express";
import mongoose, { type UpdateQuery } from "mongoose";
import { z } from "zod";
import { ResearchItem } from "../models/ResearchItem.js";
import { collection } from "../models/Collection.js";
import { User } from "../models/User.js";
import { AiSession } from "../models/AiSession.js";
import { analyzeText, askSources } from "../services/groq.js";
import { pickPassages } from "../services/passages.js";
import { buildCitations } from "../services/citations.js";
import { extractPdf, PdfImportError } from "../services/pdfImport.js";
import { streamPdf } from "../services/pdf.js";
import { toBibtex, toCsv } from "../services/export.js";
import { atLeast, ensureDefaultcollection, roleIn, collectionIds } from "../services/access.js";

const MAX_TITLE = 100;

const clipSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  publishedDate: z.string().max(100).optional(),
  rawText: z.string().min(50).max(200000),
  collectionId: z.string().optional(),
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
const sourceSchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().max(200).optional(),
  publishedDate: z.string().trim().max(100).optional(),
});
const askSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(8),
  mode: z.enum(["Research brief", "Summarize", "Compare sources"]),
  prompt: z.string().trim().max(1000).optional(),
  // user-chosen session name; empty means "fall back to the prompt" in the UI
  title: z.string().trim().max(MAX_TITLE).optional(),
  // present = re-run: update that session in place instead of creating a new one
  sessionId: z.string().optional(),
});
const renameSchema = z.object({
  title: z.string().trim().max(MAX_TITLE),
});

// Resolves the collection a clip/import goes into; answers the request itself and returns null on failure.
async function targetcollection(res: Response, userId: string, collectionId?: string) {
  if (!collectionId) return ensureDefaultcollection(userId);
  if (!mongoose.isValidObjectId(collectionId)) {
    res.status(400).json({ error: "Bad collection id" });
    return null;
  }
  const ws = await collection.findById(collectionId);
  if (!ws || !atLeast(roleIn(ws, userId), "editor")) {
    res.status(403).json({ error: "You can't add clips to that collection" });
    return null;
  }
  return ws;
}

// Runs the AI summary with the collection's settings; a failure never blocks saving.
async function runAi(ws: { aiSettings?: any }, title: string, text: string) {
  try {
    const ai = await analyzeText(title, text, {
      format: ws.aiSettings?.format,
      length: ws.aiSettings?.length,
      instructions: ws.aiSettings?.instructions,
    });
    return { ai, aiFailed: false };
  } catch (err) {
    console.error("Groq failed:", err);
    return { ai: { summary: "", paraphrase: "", tags: [] as string[] }, aiFailed: true };
  }
}

export async function clip(req: Request, res: Response) {
  const parsed = clipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid clip data" });
  const d = parsed.data;
  const userId = res.locals.userId;

  const ws = await targetcollection(res, userId, d.collectionId);
  if (!ws) return;

  const existing = await ResearchItem.findOne({ collectionId: ws._id, "source.dedupeKey": d.url }).select("_id");
  if (existing) return res.status(409).json({ error: "Already clipped", id: existing.id });

  const domain = new URL(d.url).hostname;
  const { ai, aiFailed } = await runAi(ws, d.title, d.rawText);

  const item = await ResearchItem.create({
    userId,
    collectionId: ws._id,
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

// long documents: give the AI the start (abstract/intro) and the end (conclusions)
function forAi(text: string) {
  return text.length > 12000 ? text.slice(0, 8000) + "\n[...]\n" + text.slice(-4000) : text;
}

export async function importPdf(req: Request, res: Response) {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Attach a PDF file" });
  if (file.buffer.subarray(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({ error: "That file isn't a PDF" });
  }

  const userId = res.locals.userId;
  const ws = await targetcollection(res, userId, typeof req.body?.collectionId === "string" ? req.body.collectionId : undefined);
  if (!ws) return;

  // same file content in the same collection = duplicate, even if renamed
  const dedupeKey = "pdf:" + createHash("sha256").update(file.buffer).digest("hex");
  const existing = await ResearchItem.findOne({ collectionId: ws._id, "source.dedupeKey": dedupeKey }).select("_id");
  if (existing) return res.status(409).json({ error: "This PDF is already in the collection", id: existing.id });

  let pdf;
  try {
    pdf = await extractPdf(file.buffer, file.originalname);
  } catch (e) {
    if (e instanceof PdfImportError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
  if (pdf.text.length < 50) {
    return res.status(422).json({ error: "No readable text found. Scanned (image-only) PDFs aren't supported yet." });
  }

  const rawText = pdf.text.slice(0, 200000);
  // long documents: give the AI the start (abstract/intro) and the end (conclusions)
  const { ai, aiFailed } = await runAi(ws, pdf.title, forAi(rawText));

  const item = await ResearchItem.create({
    userId,
    collectionId: ws._id,
    source: {
      kind: "pdf",
      dedupeKey,
      fileName: file.originalname.slice(0, 200),
      title: pdf.title,
      author: pdf.author,
    },
    content: { rawText, wordCount: rawText.split(/\s+/).length },
    aiOutput: { summary: ai.summary, paraphrase: ai.paraphrase },
    citations: buildCitations({ author: pdf.author, title: pdf.title }),
    tags: ai.tags,
  });

  res.status(201).json({ item, aiFailed, truncated: pdf.text.length > rawText.length });
}

async function buildFilter(req: Request, userId: string) {
  const ids = await collectionIds(userId, "viewer");
  const wid = typeof req.query.collectionId === "string" ? req.query.collectionId : "";
  const filter: Record<string, unknown> = {
    collectionId: { $in: wid ? ids.filter((i) => String(i) === wid) : ids },
  };
  if (typeof req.query.tag === "string" && req.query.tag) filter.tags = req.query.tag;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const or: Record<string, unknown>[] = [{ "source.title": rx }, { "aiOutput.summary": rx }, { tags: rx }];
    // the clip's full text, through the text index on the model (every word must appear);
    // if the index isn't there yet, search still works on titles, summaries and tags
    const words = q.split(/\s+/).map((w) => w.replace(/"/g, "")).filter(Boolean).slice(0, 8);
    if (words.length) {
      try {
        const hits = await ResearchItem.find({
          $text: { $search: words.map((w) => `"${w}"`).join(" ") },
          collectionId: filter.collectionId,
        })
          .select("_id")
          .limit(500)
          .lean();
        if (hits.length) or.push({ _id: { $in: hits.map((h) => h._id) } });
      } catch (err) {
        console.error("Full-text search unavailable:", err);
      }
    }
    filter.$or = or;
  }
  return filter;
}

// A short excerpt of the clip's text around the search term, computed in the database so the full text never travels.
async function snippetsFor(ids: unknown[], q: string) {
  const phrase = q.toLowerCase();
  const first = phrase.split(/\s+/)[0];
  try {
    const rows = await ResearchItem.aggregate([
      { $match: { _id: { $in: ids } } },
      { $project: { raw: { $ifNull: ["$content.rawText", ""] } } },
      { $addFields: { low: { $toLower: "$raw" } } },
      {
        $addFields: {
          pos: {
            $cond: [
              { $gte: [{ $indexOfCP: ["$low", phrase] }, 0] },
              { $indexOfCP: ["$low", phrase] },
              { $indexOfCP: ["$low", first] },
            ],
          },
        },
      },
      { $match: { pos: { $gte: 0 } } },
      { $project: { snippet: { $substrCP: ["$raw", { $max: [0, { $subtract: ["$pos", 80] }] }, 260] } } },
    ]);
    return new Map<string, string>(rows.map((r: any) => [String(r._id), String(r.snippet).replace(/\s+/g, " ").trim()]));
  } catch (err) {
    console.error("Snippet lookup failed:", err);
    return new Map<string, string>();
  }
}

export async function list(req: Request, res: Response) {
  const items = await ResearchItem.find(await buildFilter(req, res.locals.userId))
    .select("-content.rawText")
    .sort({ createdAt: -1 })
    .limit(100);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || !items.length) return res.json({ items });
  const snippets = await snippetsFor(items.map((i) => i._id), q);
  res.json({ items: items.map((i) => ({ ...i.toJSON(), snippet: snippets.get(String(i._id)) })) });
}

export async function getOne(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "viewer");
  const item = await ResearchItem.findOne({ _id: id, collectionId: { $in: ids } });
  if (!item) return res.status(404).json({ error: "Not found" });
  const ws = await collection.findById(item.collectionId).select("ownerId members");
  res.json({ item, role: ws ? roleIn(ws, res.locals.userId) : null });
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "editor");
  const result = await ResearchItem.deleteOne({ _id: id, collectionId: { $in: ids } });
  if (!result.deletedCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}

// Applies one update to an item the user can edit and returns the arrays that can change.
async function mutate(req: Request, res: Response, update: UpdateQuery<any>, status = 200) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "editor");
  const item = await ResearchItem.findOneAndUpdate({ _id: id, collectionId: { $in: ids } }, update, { new: true });
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

// Fix a clip's title/author/date and rebuild its citations from the corrected details.
export async function updateSource(req: Request, res: Response) {
  const p = sourceSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "A title is required" });
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "editor");

  const found = await ResearchItem.findOne({ _id: id, collectionId: { $in: ids } }).select("source").lean();
  if (!found) return res.status(404).json({ error: "Not found" });
  const s = (found.source ?? {}) as { url?: string; domain?: string };

  const { title, author = "", publishedDate = "" } = p.data;
  const item = await ResearchItem.findOneAndUpdate(
    { _id: id, collectionId: { $in: ids } },
    {
      $set: {
        "source.title": title,
        "source.author": author,
        "source.publishedDate": publishedDate,
        citations: buildCitations({ author, title, url: s.url, domain: s.domain, publishedDate }),
      },
    },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ source: item.source, citations: item.citations });
}

export async function pdf(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "viewer");
  const item = await ResearchItem.findOne({ _id: id, collectionId: { $in: ids } })
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

// Re-runs the AI summary with the collection's CURRENT settings. Tags are left alone.
export async function regenerate(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const ids = await collectionIds(res.locals.userId, "editor");
  const item = await ResearchItem.findOne({ _id: id, collectionId: { $in: ids } }).select(
    "collectionId source.kind source.title content.rawText"
  );
  if (!item) return res.status(404).json({ error: "Not found" });

  const text = item.content?.rawText ?? "";
  if (text.length < 50) return res.status(422).json({ error: "This clip has no text to summarize" });

  const ws = await collection.findById(item.collectionId).select("aiSettings");
  const settings: any = ws?.aiSettings ?? {};
  const input = item.source?.kind === "pdf" ? forAi(text) : text;

  let ai;
  try {
    ai = await analyzeText(item.source?.title ?? "Untitled", input, {
      format: settings.format,
      length: settings.length,
      instructions: settings.instructions,
    });
  } catch (err) {
    console.error("Groq failed:", err);
    return res.status(502).json({ error: "The AI service failed. Your existing summary is unchanged." });
  }
  if (!ai.summary.trim()) {
    return res.status(502).json({ error: "The AI returned an empty summary. Your existing summary is unchanged." });
  }

  await ResearchItem.updateOne(
    { _id: item._id },
    { $set: { "aiOutput.summary": ai.summary, "aiOutput.paraphrase": ai.paraphrase } }
  );
  res.json({ aiOutput: { summary: ai.summary, paraphrase: ai.paraphrase } });
}

// what each mode looks for when the person doesn't type a question
const MODE_HINT: Record<string, string> = {
  "Research brief": "main findings results conclusions limitations future research",
  Summarize: "main argument findings conclusions",
  "Compare sources": "method methodology sample participants results findings limitations",
};
const CHAR_BUDGET = 24000; // total passage text sent to the AI per request
const PASSAGE_CHARS = 900;

// AI workspace: a brief / summary / comparison across up to 8 saved sources the user can view,
// built from the passages of each source that best match the question, with quoted evidence.
export async function ask(req: Request, res: Response) {
  const p = askSchema.safeParse(req.body);
  if (!p.success || !p.data.itemIds.every((i) => mongoose.isValidObjectId(i))) {
    return res.status(400).json({ error: "Pick 1-8 sources and a valid mode" });
  }
  const { mode, sessionId } = p.data;
  if (sessionId && !mongoose.isValidObjectId(sessionId)) {
    return res.status(400).json({ error: "Bad session id" });
  }
  const prompt = p.data.prompt ?? "";
  const title = (p.data.title ?? "").slice(0, MAX_TITLE);

  const ids = await collectionIds(res.locals.userId, "viewer");
  const items = await ResearchItem.find({ _id: { $in: p.data.itemIds }, collectionId: { $in: ids } })
    .select("collectionId source.title aiOutput.summary content.rawText")
    .lean();
  if (!items.length) return res.status(404).json({ error: "Sources not found" });

  const query = prompt.trim() || MODE_HINT[mode];
  const perSource = Math.max(2, Math.min(10, Math.floor(CHAR_BUDGET / (PASSAGE_CHARS * items.length))));

  const sources = items
    .map((i: any) => ({
      id: String(i._id),
      title: i.source?.title ?? "Untitled",
      passages: pickPassages(i.content?.rawText || i.aiOutput?.summary || "", query, perSource),
    }))
    .filter((s) => s.passages.length > 0);
  if (!sources.length) return res.status(422).json({ error: "These sources have no readable text to analyze" });

  let out;
  try {
    out = await askSources(mode, prompt, sources);
  } catch (err) {
    console.error("Groq failed:", err);
    return res.status(502).json({ error: "The AI service failed. Try again." });
  }

  const refs = sources.map(({ id, title }) => ({ id, title }));
  // a failed save never loses the result the person just waited for
  const session = await saveSession({
    userId: res.locals.userId,
    collectionId: String(items[0].collectionId),
    sessionId,
    title,
    mode,
    prompt,
    sources: refs,
    out,
  });
  res.json({ ...out, sources: refs, session });
}

// ---- AI workspace sessions: private to the person who ran them, newest 20 kept per collection ----

const MAX_SESSIONS = 20;

function sessionView(s: any) {
  return {
    id: String(s._id),
    collectionId: String(s.collectionId),
    title: s.title ?? "",
    mode: s.mode,
    prompt: s.prompt ?? "",
    summary: s.summary ?? "",
    findings: (s.findings ?? []).map((f: any) => ({
      title: f.title,
      text: f.text,
      sources: f.sources ?? [],
      evidence: (f.evidence ?? []).map((e: any) => ({ source: e.source, quote: e.quote, verified: !!e.verified })),
    })),
    sources: (s.sources ?? []).map((x: any) => ({ id: x.id, title: x.title })),
    createdAt: s.createdAt,
  };
}

type SaveSessionInput = {
  userId: string;
  collectionId: string;
  sessionId?: string; // present = re-run of an existing session
  title: string;
  mode: string;
  prompt: string;
  sources: { id: string; title: string }[];
  out: {
    summary: string;
    findings: { title: string; text: string; sources: number[]; evidence: { source: number; quote: string; verified: boolean }[] }[];
  };
};

async function saveSession(input: SaveSessionInput) {
  const { userId, collectionId, sessionId, title, mode, prompt, sources, out } = input;
  try {
    // re-run: update the existing session in place (it keeps its place in Recent sessions)
    if (sessionId) {
      const updated = await AiSession.findOneAndUpdate(
        { _id: sessionId, userId, collectionId },
        { $set: { title, mode, prompt, sources, summary: out.summary, findings: out.findings } },
        { new: true }
      );
      if (updated) return sessionView(updated);
      // the session was deleted in the meantime: save this run as a new one instead
    }

    const doc = await AiSession.create({ userId, collectionId, title, mode, prompt, sources, summary: out.summary, findings: out.findings });
    const stale = await AiSession.find({ userId, collectionId })
      .sort({ createdAt: -1 })
      .skip(MAX_SESSIONS)
      .select("_id")
      .lean();
    if (stale.length) await AiSession.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    return sessionView(doc);
  } catch (err) {
    console.error("Saving AI session failed:", err);
    return null;
  }
}

export async function listSessions(req: Request, res: Response) {
  const wid = typeof req.query.collectionId === "string" ? req.query.collectionId : "";
  if (!mongoose.isValidObjectId(wid)) return res.status(400).json({ error: "Bad collection id" });
  const userId = res.locals.userId;
  const ids = await collectionIds(userId, "viewer");
  if (!ids.some((i) => String(i) === wid)) return res.json({ sessions: [] });
  const sessions = await AiSession.find({ userId, collectionId: wid }).sort({ createdAt: -1 }).limit(MAX_SESSIONS).lean();
  res.json({ sessions: sessions.map(sessionView) });
}

// Renames one of the person's own sessions. An empty title clears the name (the UI falls back to the prompt).
export async function renameSession(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const p = renameSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: `Title must be at most ${MAX_TITLE} characters` });
  const session = await AiSession.findOneAndUpdate(
    { _id: id, userId: res.locals.userId },
    { $set: { title: p.data.title } },
    { new: true }
  );
  if (!session) return res.status(404).json({ error: "Not found" });
  res.json({ session: sessionView(session) });
}

export async function removeSession(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Bad id" });
  const r = await AiSession.deleteOne({ _id: id, userId: res.locals.userId });
  if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}