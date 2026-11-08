import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { ResearchQuestion } from "../models/ResearchQuestion.js";
import { EvidenceLink, STANCES } from "../models/EvidenceLink.js";
import { Activity, type ActivityType } from "../models/Activity.js";
import { atLeast, roleIn, type Role } from "../services/access.js";

const MAX_SUPPORTING = 19; // plus the main question = 20
const MAX_LINKS = 500;

const validId = (id: unknown): id is string => typeof id === "string" && mongoose.isValidObjectId(id);

// Checks the caller's role in a collection. Not a member: 404 (so ids can't be probed). Role too low: 403.
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
    res.status(403).json({ error: "Only editors can change the board." });
    return false;
  }
  return true;
}

// Adds a line to the collection's Recent activity. The feed is a nice-to-have, so a failure here never fails the request.
type Id = string | mongoose.Types.ObjectId;
async function logActivity(collectionId: Id, actorId: Id, type: ActivityType, count = 1) {
  try {
    await Activity.create({ collectionId, actorId, type, count });
  } catch {
    /* ignore */
  }
}

// ---------- coverage ----------

type BoardLink = { questionId: string | null; stance: string; itemId?: string };

// Plain counts, no AI: what supports and challenges a question, and from how many different sources.
function summarize(questionId: string, links: BoardLink[]) {
  const mine = links.filter((l) => l.questionId === questionId);
  const count = (stance: string) => mine.filter((l) => l.stance === stance).length;
  const sources = new Set(
    mine.filter((l) => (l.stance === "supports" || l.stance === "challenges") && l.itemId).map((l) => l.itemId)
  ).size;
  return {
    questionId,
    supports: count("supports"),
    challenges: count("challenges"),
    background: count("background"),
    methodology: count("methodology"),
    open: count("open"),
    sources,
    // strength = how many different sources bear on the answer
    strength: sources === 0 ? "none" : sources === 1 ? "thin" : sources === 2 ? "moderate" : "strong",
    conflict: count("supports") > 0 && count("challenges") > 0,
  };
}

// ---------- the board ----------

export async function getBoard(req: Request, res: Response) {
  const cid = String(req.params.collectionId);
  if (!(await allow(res, cid, "viewer"))) return;

  const [questions, links] = await Promise.all([
    ResearchQuestion.find({ collectionId: cid }).sort({ kind: 1, createdAt: 1 }).lean(),
    EvidenceLink.find({ collectionId: cid }).sort({ order: 1, createdAt: 1 }).lean(),
  ]);

  const itemIds = [...new Set(links.filter((l) => l.itemId).map((l) => String(l.itemId)))];
  const items: any[] = itemIds.length
    ? await ResearchItem.find({ _id: { $in: itemIds }, collectionId: cid })
        .select("source.title source.domain source.fileName source.kind highlights")
        .lean()
    : [];
  const byId = new Map(items.map((i) => [String(i._id), i]));

  const cards: any[] = [];
  const gone: unknown[] = [];
  for (const l of links) {
    const base = {
      id: String(l._id),
      questionId: l.questionId ? String(l.questionId) : null,
      stance: l.stance,
      kind: l.kind,
      note: l.note ?? "",
      order: l.order,
    };
    if (l.kind === "note") {
      cards.push(base);
      continue;
    }
    const item = byId.get(String(l.itemId));
    const highlight =
      l.kind === "highlight" ? item?.highlights?.find((h: any) => String(h._id) === String(l.highlightId)) : undefined;
    // the clip or highlight was deleted since: drop its card
    if (!item || (l.kind === "highlight" && !highlight)) {
      gone.push(l._id);
      continue;
    }
    cards.push({
      ...base,
      itemId: String(l.itemId),
      highlightId: l.highlightId ? String(l.highlightId) : undefined,
      evidence: {
        title: item.source?.title ?? "Untitled",
        origin: item.source?.kind === "pdf" ? `PDF${item.source?.fileName ? ` · ${item.source.fileName}` : ""}` : item.source?.domain,
        quote: highlight?.text,
        color: highlight?.color,
        page: highlight?.page,
        note: highlight?.note,
      },
    });
  }
  if (gone.length) void EvidenceLink.deleteMany({ _id: { $in: gone } }).catch(() => {});

  res.json({
    questions: questions.map((q) => ({ id: String(q._id), kind: q.kind, text: q.text })),
    links: cards,
    summaries: questions.map((q) => summarize(String(q._id), cards)),
  });
}

// ---------- questions ----------

const textSchema = z.object({ text: z.string().trim().min(3).max(300) });

export async function setMainQuestion(req: Request, res: Response) {
  const cid = String(req.params.collectionId);
  if (!(await allow(res, cid, "editor"))) return;
  const p = textSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Write the question in 3 to 300 characters." });
  const q = await ResearchQuestion.findOneAndUpdate(
    { collectionId: cid, kind: "main" },
    { $set: { text: p.data.text }, $setOnInsert: { createdBy: res.locals.userId } },
    { upsert: true, returnDocument: "after" }
  );
  await logActivity(cid, res.locals.userId, "question_changed");
  res.json({ id: String(q?._id) });
}

export async function addQuestion(req: Request, res: Response) {
  const cid = String(req.params.collectionId);
  if (!(await allow(res, cid, "editor"))) return;
  const p = textSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Write the question in 3 to 300 characters." });
  if ((await ResearchQuestion.countDocuments({ collectionId: cid, kind: "supporting" })) >= MAX_SUPPORTING) {
    return res.status(400).json({ error: `A collection can have up to ${MAX_SUPPORTING} supporting questions.` });
  }
  const q = await ResearchQuestion.create({
    collectionId: cid,
    kind: "supporting",
    text: p.data.text,
    createdBy: res.locals.userId,
  });
  await logActivity(cid, res.locals.userId, "question_added");
  res.status(201).json({ id: String(q._id) });
}

export async function updateQuestion(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!validId(id)) return res.status(404).json({ error: "Not found" });
  const q = await ResearchQuestion.findById(id);
  if (!q || !(await allow(res, String(q.collectionId), "editor"))) {
    if (!q) res.status(404).json({ error: "Not found" });
    return;
  }
  const p = textSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Write the question in 3 to 300 characters." });
  q.text = p.data.text;
  await q.save();
  await logActivity(q.collectionId, res.locals.userId, "question_changed");
  res.json({ ok: true });
}

export async function removeQuestion(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!validId(id)) return res.status(404).json({ error: "Not found" });
  const q = await ResearchQuestion.findById(id);
  if (!q || !(await allow(res, String(q.collectionId), "editor"))) {
    if (!q) res.status(404).json({ error: "Not found" });
    return;
  }
  // evidence filed under this question goes with it; the highlights and clips themselves are untouched
  await EvidenceLink.deleteMany({ questionId: q._id });
  await q.deleteOne();
  await logActivity(q.collectionId, res.locals.userId, "question_removed");
  res.json({ ok: true });
}

// ---------- evidence cards ----------

const linkSchema = z.object({
  kind: z.enum(["highlight", "clip", "note"]),
  stance: z.enum(STANCES),
  questionId: z.string().nullable().optional(),
  itemId: z.string().optional(),
  highlightId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
});
const addSchema = z.object({ links: z.array(linkSchema).min(1).max(50) });

export async function addLinks(req: Request, res: Response) {
  const cid = String(req.params.collectionId);
  if (!(await allow(res, cid, "editor"))) return;
  const p = addSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Check the evidence you picked." });

  if ((await EvidenceLink.countDocuments({ collectionId: cid })) + p.data.links.length > MAX_LINKS) {
    return res.status(400).json({ error: `A board holds up to ${MAX_LINKS} cards.` });
  }

  const questionIds = new Set(
    (await ResearchQuestion.find({ collectionId: cid }).select("_id").lean()).map((q) => String(q._id))
  );
  const itemIds = [...new Set(p.data.links.map((l) => l.itemId).filter(validId))];
  const items: any[] = itemIds.length
    ? await ResearchItem.find({ _id: { $in: itemIds }, collectionId: cid }).select("highlights._id").lean()
    : [];
  const highlightsOf = new Map(items.map((i) => [String(i._id), new Set((i.highlights ?? []).map((h: any) => String(h._id)))]));

  // check everything first, so a bad card doesn't leave half the batch saved
  for (const l of p.data.links) {
    if (l.questionId && !questionIds.has(l.questionId)) {
      return res.status(400).json({ error: "That question isn't in this collection." });
    }
    if (l.kind === "note") {
      if (!l.note) return res.status(400).json({ error: "A note can't be empty." });
      continue;
    }
    const highlights = l.itemId ? highlightsOf.get(l.itemId) : undefined;
    if (!highlights || (l.kind === "highlight" && !(l.highlightId && highlights.has(l.highlightId)))) {
      return res.status(400).json({ error: "One of those items isn't in this collection." });
    }
  }

  const next = new Map<string, number>(); // the next free position in each column
  const nextOrder = async (stance: (typeof STANCES)[number]) => {
    if (!next.has(stance)) {
      const last = await EvidenceLink.findOne({ collectionId: cid, stance }).sort({ order: -1 }).select("order").lean();
      next.set(stance, (last?.order ?? -1) + 1);
    }
    const n = next.get(stance)!;
    next.set(stance, n + 1);
    return n;
  };

  let created = 0;
  let skipped = 0;
  for (const l of p.data.links) {
    try {
      await EvidenceLink.create({
        collectionId: cid,
        questionId: l.questionId || null,
        stance: l.stance,
        kind: l.kind,
        itemId: l.kind === "note" ? null : l.itemId,
        highlightId: l.kind === "highlight" ? l.highlightId : null,
        note: l.kind === "note" ? l.note : "",
        order: await nextOrder(l.stance),
        createdBy: res.locals.userId,
      });
      created++;
    } catch (err: any) {
      if (err?.code === 11000) skipped++; // already on the board for that question
      else throw err;
    }
  }
  if (created > 0) await logActivity(cid, res.locals.userId, "evidence_added", created);
  res.status(201).json({ created, skipped });
}

const patchSchema = z.object({
  stance: z.enum(STANCES).optional(),
  questionId: z.string().nullable().optional(), // null = not tied to a question
  note: z.string().trim().min(1).max(1000).optional(),
  beforeId: z.string().nullable().optional(), // put the card before this one in its column; null = at the end
});

export async function updateLink(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!validId(id)) return res.status(404).json({ error: "Not found" });
  const link = await EvidenceLink.findById(id);
  if (!link) return res.status(404).json({ error: "Not found" });
  if (!(await allow(res, String(link.collectionId), "editor"))) return;
  const p = patchSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid change." });

  const set: Record<string, unknown> = {};
  if (p.data.questionId !== undefined) {
    if (p.data.questionId) {
      const found = validId(p.data.questionId)
        ? await ResearchQuestion.exists({ _id: p.data.questionId, collectionId: link.collectionId })
        : null;
      if (!found) return res.status(400).json({ error: "That question isn't in this collection." });
    }
    set.questionId = p.data.questionId;
  }
  if (p.data.note !== undefined) {
    if (link.kind !== "note") return res.status(400).json({ error: "Only notes have text to edit." });
    set.note = p.data.note;
  }
  if (p.data.stance) set.stance = p.data.stance;

  const movedColumn = !!p.data.stance && p.data.stance !== link.stance;
  const stance = p.data.stance ?? link.stance;
  const reorder = p.data.stance !== undefined || p.data.beforeId !== undefined;
  try {
    if (!reorder) {
      if (Object.keys(set).length) await EvidenceLink.updateOne({ _id: link._id }, { $set: set });
    } else {
      const column = await EvidenceLink.find({ collectionId: link.collectionId, stance, _id: { $ne: link._id } })
        .sort({ order: 1, createdAt: 1 })
        .select("_id")
        .lean();
      let at = p.data.beforeId ? column.findIndex((c) => String(c._id) === p.data.beforeId) : -1;
      if (at < 0) at = column.length;
      const ids = [...column.slice(0, at).map((c) => c._id), link._id, ...column.slice(at).map((c) => c._id)];
      await EvidenceLink.bulkWrite(
        ids.map((cardId, order) => ({
          updateOne: {
            filter: { _id: cardId },
            update: { $set: String(cardId) === String(link._id) ? { ...set, order } : { order } },
          },
        }))
      );
    }
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "That evidence is already filed under this question." });
    }
    throw err;
  }
  // only a move to another column is news; reordering inside a column or re-filing under a question isn't logged
  if (movedColumn) await logActivity(link.collectionId, res.locals.userId, "evidence_moved");
  res.json({ ok: true });
}

export async function removeLink(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!validId(id)) return res.status(404).json({ error: "Not found" });
  const link = await EvidenceLink.findById(id);
  if (!link) return res.status(404).json({ error: "Not found" });
  if (!(await allow(res, String(link.collectionId), "editor"))) return;
  await link.deleteOne();
  await logActivity(link.collectionId, res.locals.userId, "evidence_removed");
  res.json({ ok: true });
}