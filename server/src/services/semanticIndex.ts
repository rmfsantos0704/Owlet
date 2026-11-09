import crypto from "node:crypto";
import type { Types } from "mongoose";
import { ResearchItem } from "../models/ResearchItem.js";
import { collection } from "../models/Collection.js";
import { SearchChunk } from "../models/SearchChunk.js";
import { SearchIndexState } from "../models/SearchIndexState.js";
import { User } from "../models/User.js";
import { chunk } from "./passages.js";
import { embedTexts, MODEL_TAG } from "./embeddings.js";

const BODY_CHUNK_CHARS = 1000;
const MAX_BODY_CHUNKS = 40; // per clip; longer texts are sampled evenly from start to end
const MAX_SMALL_CHUNKS = 100; // highlights, and comments, per clip
const MAX_TEXT = 1500;

type Kind = "clip" | "highlight" | "comment" | "matrix";
type Draft = { kind: Kind; refId: string | null; idx: number; text: string; embedText: string; hash: string };

const sha = (s: string) => crypto.createHash("sha1").update(`${MODEL_TAG}:${s}`).digest("hex");
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

function evenly<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  return Array.from({ length: max }, (_, k) => list[Math.round((k * (list.length - 1)) / (max - 1))]);
}

type Column = { id: string; name: string };

// Everything about one clip that someone might search for, as pieces small enough to embed.
function buildChunks(item: any, columns: Column[]): Draft[] {
  const title = String(item.source?.title ?? "Untitled");
  const drafts: Draft[] = [];
  const add = (kind: Kind, refId: string | null, idx: number, text: string) => {
    const shown = clip(text.trim(), MAX_TEXT);
    if (shown.length < 3) return;
    const embedText = `${title}\n${shown}`; // the title gives each piece its context
    drafts.push({ kind, refId, idx, text: shown, embedText, hash: sha(embedText) });
  };

  // overview: title, tags, and summaries
  const overview = [item.aiOutput?.summary, item.userSummary, (item.tags ?? []).join(", ")].filter(Boolean).join("\n");
  add("clip", null, 0, overview || title);

  // the clip's own text
  const body = chunk(String(item.content?.rawText ?? ""), BODY_CHUNK_CHARS);
  evenly(body, MAX_BODY_CHUNKS).forEach((text, k) => add("clip", null, k + 1, text));

  for (const h of (item.highlights ?? []).slice(0, MAX_SMALL_CHUNKS)) {
    add("highlight", String(h._id), 0, h.note ? `${h.text}\nNote: ${h.note}` : String(h.text ?? ""));
  }
  for (const c of (item.comments ?? []).slice(0, MAX_SMALL_CHUNKS)) {
    add("comment", String(c._id), 0, String(c.text ?? ""));
  }

  // literature matrix: one piece per clip, made of its filled-in cells
  const values: Record<string, string> =
    item.matrixValues instanceof Map ? Object.fromEntries(item.matrixValues) : (item.matrixValues ?? {});
  const cells = columns.filter((c) => String(values[c.id] ?? "").trim()).map((c) => `${c.name}: ${String(values[c.id]).trim()}`);
  if (cells.length) add("matrix", null, 0, cells.join("\n"));

  return drafts;
}

const keyOf = (c: { kind: string; refId?: unknown; idx: number }) => `${c.kind}:${c.refId ? String(c.refId) : ""}:${c.idx}`;

// Brings one clip's pieces up to date: embeds only what is new or changed, removes what is gone.
async function reindexItem(itemId: Types.ObjectId | string, columns: Column[]) {
  const startedAt = new Date(); // a change made while indexing keeps the clip marked out of date
  const item: any = await ResearchItem.findById(itemId)
    .select("collectionId source.title aiOutput.summary userSummary tags content.rawText highlights comments matrixValues")
    .lean();
  if (!item) return;

  // comments written by people who turned AI off are never sent to the embeddings provider
  const commenters = [...new Set((item.comments ?? []).map((c: any) => c.userId).filter(Boolean).map(String))];
  if (commenters.length) {
    const blocked = new Set(
      (await User.find({ _id: { $in: commenters }, aiOptOut: true }).select("_id").lean()).map((u: any) => String(u._id))
    );
    item.comments = (item.comments ?? []).filter((c: any) => !(c.userId && blocked.has(String(c.userId))));
  }

  const desired = buildChunks(item, columns);
  const existing: any[] = await SearchChunk.find({ itemId }).select("kind refId idx hash").lean();
  const have = new Map(existing.map((c) => [keyOf(c), c.hash]));
  const wanted = new Set(desired.map(keyOf));

  const toEmbed = desired.filter((d) => have.get(keyOf(d)) !== d.hash);
  if (toEmbed.length) {
    const vectors = await embedTexts(toEmbed.map((d) => d.embedText), "document");
    await SearchChunk.bulkWrite(
      toEmbed.map((d, i) => ({
        updateOne: {
          filter: { itemId: item._id, kind: d.kind, refId: d.refId, idx: d.idx },
          update: {
            $set: { collectionId: item.collectionId, text: d.text, hash: d.hash, model: MODEL_TAG, embedding: vectors[i] },
          },
          upsert: true,
        },
      }))
    );
  }
  const gone = existing.filter((c) => !wanted.has(keyOf(c))).map((c) => c._id);
  if (gone.length) await SearchChunk.deleteMany({ _id: { $in: gone } });

  await SearchIndexState.updateOne(
    { itemId: item._id },
    { $set: { collectionId: item.collectionId, indexedAt: startedAt, model: MODEL_TAG, chunkCount: desired.length } },
    { upsert: true }
  );
}

// Finds the clips in these collections that are not indexed yet, or changed since, and indexes as many as the
// time budget allows (newest first). Returns how many are still waiting, so the caller can ask again.
export async function indexStale(scope: Types.ObjectId[], budgetMs: number) {
  const started = Date.now();
  const [everyClip, states] = await Promise.all([
    ResearchItem.find({ collectionId: { $in: scope } }).select("_id collectionId updatedAt userId").sort({ updatedAt: -1 }).lean(),
    SearchIndexState.find({ collectionId: { $in: scope } }).lean(),
  ]);

  // clips made by people who turned AI off are left out. Anything already indexed for them is removed below,
  // because they no longer count as alive.
  const authors = [...new Set(everyClip.map((i: any) => i.userId).filter(Boolean).map(String))];
  const optedOut = new Set(
    authors.length ? (await User.find({ _id: { $in: authors }, aiOptOut: true }).select("_id").lean()).map((u: any) => String(u._id)) : []
  );
  const items = everyClip.filter((i: any) => !(i.userId && optedOut.has(String(i.userId))));
  const stateOf = new Map<string, any>(states.map((s: any) => [String(s.itemId), s]));

  // clips deleted since they were indexed: remove their pieces
  const alive = new Set(items.map((i: any) => String(i._id)));
  const orphans = states.filter((s: any) => !alive.has(String(s.itemId))).map((s: any) => s.itemId);
  if (orphans.length) {
    await Promise.all([SearchChunk.deleteMany({ itemId: { $in: orphans } }), SearchIndexState.deleteMany({ itemId: { $in: orphans } })]);
  }

  const stale = items.filter((i: any) => {
    const s = stateOf.get(String(i._id));
    return !s || s.model !== MODEL_TAG || +new Date(s.indexedAt) < +new Date(i.updatedAt);
  });

  const columnsOf = new Map<string, Column[]>();
  (await collection.find({ _id: { $in: scope } }).select("matrixColumns")).forEach((c: any) =>
    columnsOf.set(String(c._id), (c.matrixColumns ?? []).filter((m: Column) => m.id && m.name))
  );

  let indexed = 0;
  for (const item of stale as any[]) {
    if (Date.now() - started > budgetMs) break;
    await reindexItem(item._id, columnsOf.get(String(item.collectionId)) ?? []);
    indexed++;
  }
  return { indexed, pending: stale.length - indexed, total: items.length };
}