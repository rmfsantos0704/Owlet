import { Workspace } from "../models/Workspace.js";
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

// ids of every workspace where this user has at least the given role
export async function workspaceIds(userId: string, min: Role) {
  const list = await Workspace.find({ $or: [{ ownerId: userId }, { "members.userId": userId }] }).select("ownerId members");
  return list.filter((w) => atLeast(roleIn(w, userId), min)).map((w) => w._id);
}

export async function ensureDefaultWorkspace(userId: string) {
  let ws = await Workspace.findOne({ ownerId: userId, isDefault: true });
  if (!ws) {
    try {
      ws = await Workspace.create({ name: "Personal", ownerId: userId, isDefault: true });
    } catch {
      ws = await Workspace.findOne({ ownerId: userId, isDefault: true }); // created by a parallel request
    }
  }
  if (!ws) throw new Error("Could not create default workspace");
  // adopt clips made before workspaces existed
await ResearchItem.updateMany(
  { userId, workspaceId: { $exists: false } },
  [{ $set: { workspaceId: ws._id, "source.dedupeKey": "$source.url", "source.kind": "web" } }],
  { updatePipeline: true }
);
  return ws;
}