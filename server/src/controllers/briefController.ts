import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { ResearchQuestion } from "../models/ResearchQuestion.js";
import { EvidenceLink } from "../models/EvidenceLink.js";
import { Brief } from "../models/Brief.js";
import { AiProvidersError, composeBrief, type BriefDraft, type BriefSource } from "../services/ai.js";
import { composeBriefOutline, type OutlineLink, type OutlineSource } from "../services/briefOutline.js";
import { pickPassages } from "../services/passages.js";
import { BRIEF_TEMPLATES, BRIEF_TEMPLATE_IDS } from "../services/briefTemplates.js";
import { streamBriefPdf } from "../services/briefPdf.js";
import { atLeast, roleIn, type Role } from "../services/access.js";
import { AiOptedOutError, AiQuotaExceededError, refundAiGeneration } from "../services/aiUsage.js";

const MAX_SOURCES = 8;
const TEXT_CHAR_BUDGET = 16000; // passage text from the sources' own words, shared between all sources
const PASSAGE_CHARS = 900;
const MAX_HIGHLIGHTS = 12; // per source
const HIGHLIGHT_BASE = 1000; // passage numbers: highlights start here, matrix cells at MATRIX_BASE
const MATRIX_BASE = 2000;
const MAX_BRIEFS_PER_COLLECTION = 100;

const validId = (id: unknown): id is string => typeof id === "string" && mongoose.isValidObjectId(id);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

async function allow(res: Response, collectionId: string, min: Role): Promise<boolean> {
  if (!validId(collectionId)) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  const ws = await collection.findById(collectionId).select("ownerId members");
  const role = ws ? roleIn(ws, res.locals.userId) : null;
  if (!role) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  if (!atLeast(role, min)) {
    res.status(403).json({ error: "Only editors can change briefs." });
    return false;
  }
  return true;
}

function serialize(b: any) {
  return {
    id: String(b._id),
    collectionId: String(b.collectionId),
    title: b.title,
    template: b.template,
    question: b.question ?? "",
    status: b.status,
    generator: b.generator ?? "ai",
    wordCount: b.wordCount ?? 0,
    sources: (b.sources ?? []).map((s: any) => ({ itemId: String(s.itemId), title: s.title, reference: s.reference })),
    sections: (b.sections ?? []).map((s: any) => ({
      id: String(s._id),
      title: s.title,
      blocks: (s.blocks ?? []).map((k: any) => ({
        id: String(k._id),
        text: k.text,
        edited: !!k.edited,
        citations: (k.citations ?? []).map((c: any) => ({
          source: c.source,
          itemId: c.itemId ? String(c.itemId) : undefined,
          highlightId: c.highlightId ? String(c.highlightId) : undefined,
          kind: c.kind,
          quote: c.quote,
          verified: !!c.verified,
        })),
      })),
    })),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// ---------- list and read ----------

export async function listBriefs(req: Request, res: Response) {
  const cid = String(req.query.collectionId ?? "");
  if (!(await allow(res, cid, "viewer"))) return;
  const briefs: any[] = await Brief.find({ collectionId: cid })
    .sort({ updatedAt: -1 })
    .select("title template question status generator sources.itemId wordCount updatedAt createdAt")
    .lean();
  res.json({
    briefs: briefs.map((b) => ({
      id: String(b._id),
      title: b.title,
      template: b.template,
      question: b.question ?? "",
      status: b.status,
      generator: b.generator ?? "ai",
      sourceCount: (b.sources ?? []).length,
      wordCount: b.wordCount ?? 0,
      updatedAt: b.updatedAt,
    })),
  });
}

async function loadBrief(req: Request, res: Response, min: Role) {
  const id = String(req.params.id);
  if (!validId(id)) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  const brief = await Brief.findById(id);
  if (!brief) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (!(await allow(res, String(brief.collectionId), min))) return null;
  return brief;
}

export async function getBrief(req: Request, res: Response) {
  const brief = await loadBrief(req, res, "viewer");
  if (brief) res.json({ brief: serialize(brief) });
}

export async function briefPdf(req: Request, res: Response) {
  const brief = await loadBrief(req, res, "viewer");
  if (brief) streamBriefPdf(serialize(brief), res);
}

// ---------- generate ----------

const createSchema = z.object({
  collectionId: z.string(),
  template: z.enum(BRIEF_TEMPLATE_IDS),
  itemIds: z.array(z.string()).min(1).max(MAX_SOURCES),
  title: z.string().trim().max(120).optional(),
  question: z.string().trim().max(300).optional(),
  useBoard: z.boolean().optional(), // AI: show the writer how the board is organized. Outline: group the sections by the board
  mode: z.enum(["ai", "outline"]).optional(), // "outline" = no AI: gather the researcher's material and let them write the text
});

const STANCE_LABEL: Record<string, string> = {
  supports: "Supports",
  challenges: "Challenges",
  background: "Background",
  methodology: "Methodology",
  open: "Open question",
};

export async function createBrief(req: Request, res: Response) {
  const p = createSchema.safeParse(req.body);
  if (!p.success || !p.data.itemIds.every(validId)) {
    return res.status(400).json({ error: `Pick a template and 1-${MAX_SOURCES} sources.` });
  }
  const cid = p.data.collectionId;
  const wantOutline = p.data.mode === "outline";
  if (!(await allow(res, cid, "editor"))) return;
  if ((await Brief.countDocuments({ collectionId: cid })) >= MAX_BRIEFS_PER_COLLECTION) {
    return res.status(400).json({ error: `A collection can hold up to ${MAX_BRIEFS_PER_COLLECTION} briefs. Delete one first.` });
  }

  const ws = await collection.findById(cid).select("matrixColumns");
  const columns = ((ws?.get("matrixColumns") as { id: string; name: string }[] | undefined) ?? []).filter((c) => c.id && c.name);

  const found: any[] = await ResearchItem.find({ _id: { $in: p.data.itemIds }, collectionId: cid })
    .select("source.title citations.apa highlights matrixValues content.rawText aiOutput.summary personalNote")
    .lean();
  // keep the order the person picked them in
  const items = p.data.itemIds.map((id) => found.find((i) => String(i._id) === id)).filter(Boolean);
  if (!items.length) return res.status(404).json({ error: "Sources not found" });

  const template = BRIEF_TEMPLATES[p.data.template];

  // main question: what the person typed, else the collection's main question when sharing the board
  let question = p.data.question ?? "";
  if (!question && p.data.useBoard) {
    const main = await ResearchQuestion.findOne({ collectionId: cid, kind: "main" }).select("text").lean();
    question = main?.text ?? "";
  }

  const query = question || template.label;
  const perSource = Math.max(2, Math.min(8, Math.floor(TEXT_CHAR_BUDGET / (PASSAGE_CHARS * items.length))));

  // what each numbered passage really is, so citations can point back to a highlight or matrix cell
  const meta = items.map(() => new Map<number, { kind: "text" | "highlight" | "matrix"; highlightId?: string }>());
  const sources: BriefSource[] = items.map((item: any, index: number) => {
    const passages = pickPassages(item.content?.rawText || item.aiOutput?.summary || "", query, perSource);
    passages.forEach((passage) => meta[index].set(passage.n, { kind: "text" }));
    (item.highlights ?? []).slice(0, MAX_HIGHLIGHTS).forEach((h: any, i: number) => {
      const n = HIGHLIGHT_BASE + i;
      meta[index].set(n, { kind: "highlight", highlightId: String(h._id) });
      const note = h.note ? ` (researcher's note: ${clip(String(h.note), 200)})` : "";
      passages.push({ n, text: clip(String(h.text), 500) + note });
    });
    const matrix: Record<string, string> = item.matrixValues instanceof Map ? Object.fromEntries(item.matrixValues) : (item.matrixValues ?? {});
    columns.forEach((column, i) => {
      const value = String(matrix[column.id] ?? "").trim();
      if (!value) return;
      const n = MATRIX_BASE + i;
      meta[index].set(n, { kind: "matrix" });
      passages.push({ n, text: `${column.name}: ${clip(value, 400)}` });
    });
    return { title: item.source?.title ?? "Untitled", passages };
  });
  if (sources.every((s) => s.passages.length === 0) && (!wantOutline || items.every((i: any) => !String(i.personalNote ?? "").trim()))) {
    return res.status(422).json({ error: "These sources have no text, highlights or notes to build a brief from." });
  }

  // how the evidence board is organized, as plain context for the writer
  let context = "";
  const boardLinks: OutlineLink[] = []; // the same board cards, for the no-AI outline
  if (p.data.useBoard) {
    const positionOf = new Map(items.map((item: any, i: number) => [String(item._id), i]));
    const [links, questions] = await Promise.all([
      EvidenceLink.find({ collectionId: cid }).sort({ stance: 1, order: 1 }).limit(80).lean(),
      ResearchQuestion.find({ collectionId: cid, kind: "supporting" }).select("text").lean(),
    ]);
    const lines: string[] = [];
    if (questions.length) lines.push(`Supporting questions: ${questions.map((q: any) => q.text).join(" | ")}`);
    for (const link of links) {
      const label = STANCE_LABEL[link.stance] ?? link.stance;
      if (link.kind === "note") {
        lines.push(`- [${label}] note: ${clip(link.note ?? "", 200)}`);
        continue;
      }
      const at = positionOf.get(String(link.itemId));
      if (at === undefined) continue;
      const item: any = items[at];
      const highlight = link.kind === "highlight" ? item.highlights?.find((h: any) => String(h._id) === String(link.highlightId)) : undefined;
      lines.push(
        highlight
          ? `- [${label}] source ${at + 1}: "${clip(String(highlight.text), 160)}"`
          : `- [${label}] source ${at + 1} as a whole`
      );
    }
    context = clip(lines.join("\n"), 3500);
    for (const link of links) {
      const isNote = link.kind === "note";
      const at = isNote ? undefined : positionOf.get(String(link.itemId));
      if (!isNote && at === undefined) continue;
      boardLinks.push({
        stance: String(link.stance),
        kind: link.kind as OutlineLink["kind"],
        note: String(link.note ?? ""),
        source: at ?? null,
        highlightId: link.highlightId ? String(link.highlightId) : null,
      });
    }
  }

  const references = items.map((item: any) => item.citations?.apa || item.source?.title || "Untitled");

  // "outline" mode skips the AI entirely. Otherwise try the AI first, and when it is off, used up or failing,
  // build the outline instead, so the person always gets something they can finish.
  const userId = String(res.locals.userId);
  let draft: BriefDraft | null = null;
  let generator: "ai" | "outline" = "ai";
  let fellBack: "off" | "quota" | "providers" | null = null;

  if (!wantOutline) {
    try {
      draft = await composeBrief(
        userId,
        { label: template.label, instruction: template.instruction, sections: template.sections, question, context },
        sources
      );
      if (!draft.sections.length) {
        // the AI answered but gave nothing usable: give the allowance back and use the outline
        draft = null;
        fellBack = "providers";
        await refundAiGeneration(userId).catch(() => {});
      }
    } catch (err) {
      if (err instanceof AiOptedOutError) fellBack = "off";
      else if (err instanceof AiQuotaExceededError) fellBack = "quota";
      else {
        console.error("AI providers failed, building an outline instead:", err);
        fellBack = "providers";
        // the allowance was reserved before the providers were called; a failed attempt shouldn't cost it
        if (err instanceof AiProvidersError) await refundAiGeneration(userId).catch(() => {});
      }
    }
  }
  if (!draft) {
    const outlineSources: OutlineSource[] = items.map((item: any, i: number) => ({
      title: item.source?.title ?? "Untitled",
      reference: references[i],
      personalNote: clip(String(item.personalNote ?? "").trim(), 600),
      highlights: (item.highlights ?? []).slice(0, MAX_HIGHLIGHTS).map((h: any, j: number) => ({
        n: HIGHLIGHT_BASE + j,
        id: String(h._id),
        text: clip(String(h.text), 500),
        note: h.note ? clip(String(h.note), 300) : "",
      })),
      matrix: sources[i].passages.filter((ps) => ps.n >= MATRIX_BASE).map((ps) => ({ n: ps.n, text: ps.text })),
    }));
    draft = composeBriefOutline(outlineSources, {
      links: boardLinks,
      titleFrom: template.sections ? "title" : "reference",
      perSource: template.sections === null,
    });
    generator = "outline";
  }

  const sections = draft.sections.map((section, index) => ({
    // an annotated bibliography uses each source's reference as the section title
    title: generator === "outline" || template.sections ? section.title : (references[index] ?? section.title),
    blocks: section.blocks.map((block) => ({
      text: block.text,
      citations: block.evidence.map((e) => {
        const info = meta[e.source - 1]?.get(e.passage);
        return {
          source: e.source,
          itemId: (items[e.source - 1] as any)._id,
          highlightId: info?.highlightId ?? null,
          kind: info?.kind ?? "text",
          quote: e.quote,
          verified: e.verified,
        };
      }),
    })),
  }));

  const brief = await Brief.create({
    collectionId: cid,
    createdBy: res.locals.userId,
    title: p.data.title || `${template.label}: ${clip(items.map((i: any) => i.source?.title ?? "Untitled").join(", "), 70)}`,
    template: p.data.template,
    question,
    sources: items.map((item: any, i: number) => ({ itemId: item._id, title: item.source?.title ?? "Untitled", reference: references[i] })),
    sections,
    generator,
    wordCount: sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + words(b.text), 0), 0),
  });
  res.status(201).json({ brief: serialize(brief), fellBack });
}

// ---------- edit and delete ----------

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["draft", "ready"]).optional(),
  question: z.string().trim().max(300).optional(),
  blocks: z.record(z.string(), z.string().trim().min(1).max(4000)).optional(), // block id -> new text
  removeBlocks: z.array(z.string()).max(200).optional(),
});

export async function updateBrief(req: Request, res: Response) {
  const brief = await loadBrief(req, res, "editor");
  if (!brief) return;
  const p = patchSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid change." });

  if (p.data.title !== undefined) brief.title = p.data.title;
  if (p.data.status !== undefined) brief.status = p.data.status;
  if (p.data.question !== undefined) brief.question = p.data.question;

  const remove = new Set(p.data.removeBlocks ?? []);
  for (const section of brief.sections) {
    for (const block of section.blocks) {
      const next = p.data.blocks?.[String(block._id)];
      if (next !== undefined && next !== block.text) {
        block.text = next;
        block.edited = true;
      }
    }
    if (remove.size) (section.blocks as any).pull(...[...remove].filter(validId));
  }
  if (remove.size) brief.sections = brief.sections.filter((s) => s.blocks.length > 0) as any;
  brief.wordCount = brief.sections.reduce((n, s) => n + s.blocks.reduce((m, b) => m + words(b.text ?? ""), 0), 0);

  await brief.save();
  res.json({ brief: serialize(brief) });
}

export async function removeBrief(req: Request, res: Response) {
  const brief = await loadBrief(req, res, "editor");
  if (!brief) return;
  await brief.deleteOne();
  res.json({ ok: true });
}