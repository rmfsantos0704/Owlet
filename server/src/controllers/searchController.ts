import type { Request, Response } from "express";
import mongoose, { type Types } from "mongoose";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { SearchChunk } from "../models/SearchChunk.js";
import { atLeast, collectionIds, roleIn } from "../services/access.js";
import { EmbeddingsUnavailableError, embedTexts, embeddingsConfigured } from "../services/embeddings.js";
import { indexStale } from "../services/semanticIndex.js";
import { aiOptedOut } from "../services/aiUsage.js";

// the name of the Atlas vector index (see the setup steps)
const VECTOR_INDEX = process.env.VECTOR_INDEX_NAME || "search_chunks_vector";
// Atlas scores run from 0 to 1 and relevant and unrelated text sit close together, so results are kept
// relative to the best match instead of against a fixed cut-off. Raise MATCH_GAP to show more, lower it to show less.
const MATCH_GAP = 0.08;
const MAX_RESULTS = 30;
const SEARCH_INDEX_BUDGET_MS = 3500; // out-of-date clips get indexed first, within this time
const INDEX_BUDGET_MS = 7000;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function offByUser(res: Response) {
  return res.status(403).json({
    error: "You turned off AI features in your account. You can turn them back on in Account settings.",
    code: "AI_OFF_BY_USER",
  });
}

function unavailable(res: Response) {
  return res.status(503).json({ error: "Concept search isn't set up on this server yet.", code: "SEMANTIC_UNAVAILABLE" });
}

// the collections to look in: one the caller can read, or all of them
async function scopeOf(req: Request, res: Response): Promise<Types.ObjectId[] | null> {
  const id = String(req.query.collectionId ?? req.body?.collectionId ?? "");
  if (id && id !== "all") {
    if (!mongoose.isValidObjectId(id)) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    const ws = await collection.findById(id).select("ownerId members");
    if (!ws || !atLeast(roleIn(ws, res.locals.userId), "viewer")) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    return [ws._id];
  }
  return (await collectionIds(res.locals.userId, "viewer")) as Types.ObjectId[];
}

export async function semanticSearch(req: Request, res: Response) {
  if (!embeddingsConfigured()) return unavailable(res);
  if (await aiOptedOut(String(res.locals.userId))) return offByUser(res);
  const q = String(req.query.q ?? "").trim().slice(0, 300);
  if (q.length < 3) return res.status(400).json({ error: "Type a few words to search." });
  const scope = await scopeOf(req, res);
  if (!scope) return;
  if (!scope.length) return res.json({ results: [], pending: 0, total: 0 });

  try {
    // clips that are new or changed are indexed first, so results are current
    const status = await indexStale(scope, SEARCH_INDEX_BUDGET_MS);
    const [vector] = await embedTexts([q], "query");

    const hits: any[] = await SearchChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          path: "embedding",
          queryVector: vector,
          numCandidates: 200,
          limit: 60,
          filter: { collectionId: { $in: scope } },
        },
      },
      { $addFields: { score: { $meta: "vectorSearchScore" } } },
      { $project: { embedding: 0, hash: 0 } },
    ]);

    const top = hits[0]?.score ?? 0;
    const kept: any[] = [];
    const seenClip = new Set<string>();
    for (const hit of hits) {
      if (hit.score < top - MATCH_GAP) break;
      if (hit.kind === "clip") {
        // several passages of one clip count once
        const key = String(hit.itemId);
        if (seenClip.has(key)) continue;
        seenClip.add(key);
      }
      kept.push(hit);
      if (kept.length >= MAX_RESULTS) break;
    }

    const itemIds = [...new Set(kept.map((h) => String(h.itemId)))];
    const [items, names]: [any[], any[]] = await Promise.all([
      itemIds.length
        ? ResearchItem.find({ _id: { $in: itemIds } })
            .select("collectionId source.title source.domain source.fileName source.kind highlights._id highlights.color highlights.page comments._id comments.authorEmail")
            .lean()
        : Promise.resolve([]),
      scope.length > 1 ? collection.find({ _id: { $in: scope } }).select("name").lean() : Promise.resolve([]),
    ]);
    const itemById = new Map(items.map((i) => [String(i._id), i]));
    const nameById = new Map(names.map((c: any) => [String(c._id), c.name]));

    const results = kept
      .map((hit) => {
        const item = itemById.get(String(hit.itemId));
        if (!item) return null; // the clip was deleted since it was indexed
        const gap = top - hit.score;
        const highlight = hit.kind === "highlight" ? item.highlights?.find((h: any) => String(h._id) === String(hit.refId)) : undefined;
        const comment = hit.kind === "comment" ? item.comments?.find((c: any) => String(c._id) === String(hit.refId)) : undefined;
        return {
          id: String(hit._id),
          kind: hit.kind,
          itemId: String(hit.itemId),
          collectionId: String(hit.collectionId),
          collectionName: nameById.get(String(hit.collectionId)),
          title: item.source?.title ?? "Untitled",
          origin: item.source?.kind === "pdf" ? `PDF${item.source?.fileName ? ` · ${item.source.fileName}` : ""}` : item.source?.domain,
          snippet: clip(String(hit.text ?? ""), 320),
          match: gap <= 0.02 ? "strong" : gap <= 0.05 ? "good" : "related",
          page: highlight?.page,
          color: highlight?.color,
          author: comment?.authorEmail,
        };
      })
      .filter(Boolean);

    res.json({ results, pending: status.pending, total: status.total });
  } catch (err) {
    if (err instanceof EmbeddingsUnavailableError) return unavailable(res);
    console.error("Semantic search failed:", err);
    res.status(502).json({ error: "Search is unavailable right now. Try again in a moment." });
  }
}

// The page calls this again and again after a search that reported pending clips, until none are left.
export async function indexLibrary(req: Request, res: Response) {
  if (!embeddingsConfigured()) return unavailable(res);
  if (await aiOptedOut(String(res.locals.userId))) return offByUser(res);
  const scope = await scopeOf(req, res);
  if (!scope) return;
  try {
    res.json(scope.length ? await indexStale(scope, INDEX_BUDGET_MS) : { indexed: 0, pending: 0, total: 0 });
  } catch (err) {
    if (err instanceof EmbeddingsUnavailableError) return unavailable(res);
    console.error("Indexing failed:", err);
    res.status(502).json({ error: "Couldn't index your library right now. Try again in a moment." });
  }
}