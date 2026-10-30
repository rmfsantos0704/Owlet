import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";

export type Role = "owner" | "editor" | "viewer";
const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

type WsLike = { ownerId: unknown; members: { userId: unknown; role: string }[] };

export function roleIn(ws: WsLike, userId: string): Role | null {
  if (String(ws.ownerId) === String(userId)) return "owner";
  const m = ws.members.find((x) => String(x.userId) === String(userId));
  return m ? (m.role as Role) : null;
}

export const atLeast = (role: Role | null, min: Role) => !!role && RANK[role] >= RANK[min];

// ids of every collection where this user has at least the given role
export async function collectionIds(userId: string, min: Role) {
  const list = await collection.find({ $or: [{ ownerId: userId }, { "members.userId": userId }] }).select("ownerId members");
  return list.filter((w) => atLeast(roleIn(w, userId), min)).map((w) => w._id);
}

export async function ensureDefaultcollection(userId: string) {
  let ws = await collection.findOne({ ownerId: userId, isDefault: true });
  if (!ws) {
    try {
      ws = await collection.create({ name: "Personal", ownerId: userId, isDefault: true });
    } catch {
      ws = await collection.findOne({ ownerId: userId, isDefault: true }); // created by a parallel request
    }
  }
  if (!ws) throw new Error("Could not create default collection");
  // adopt clips made before collections existed
  await ResearchItem.updateMany(
    { userId, collectionId: { $exists: false } },
    [{ $set: { collectionId: ws._id, "source.dedupeKey": "$source.url", "source.kind": "web" } }],
    { updatePipeline: true }
  );
  return ws;
}