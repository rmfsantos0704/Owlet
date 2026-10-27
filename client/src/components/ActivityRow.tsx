import { Bookmark, FileText, Highlighter, LogOut, MessageSquareText, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import type { ActivityEntry, ActivityPerson, ActivityType } from "../types";

const ICONS: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  clip_added: { icon: Bookmark, tone: "bg-blue-50 text-blue-600" },
  pdf_imported: { icon: FileText, tone: "bg-violet-50 text-violet-600" },
  highlight_added: { icon: Highlighter, tone: "bg-amber-50 text-amber-600" },
  comment_added: { icon: MessageSquareText, tone: "bg-emerald-50 text-emerald-600" },
  member_joined: { icon: UserPlus, tone: "bg-cyan-50 text-cyan-600" },
  member_left: { icon: LogOut, tone: "bg-slate-100 text-slate-500" },
  member_removed: { icon: UserMinus, tone: "bg-slate-100 text-slate-500" },
};

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const name = (p: ActivityPerson | null) => (p?.isYou ? "You" : p?.email ?? "Someone");

// the sentence after the person's name, and whether it ends with the clip's title
function sentence(a: ActivityEntry): { text: string; withTitle: boolean } {
  const n = a.count;
  switch (a.type) {
    case "clip_added": return { text: "clipped", withTitle: true };
    case "pdf_imported": return n > 1 ? { text: `imported ${n} PDFs`, withTitle: false } : { text: "imported", withTitle: true };
    case "highlight_added": return { text: n > 1 ? `added ${n} highlights to` : "added a highlight to", withTitle: true };
    case "comment_added": return { text: n > 1 ? `added ${n} comments on` : "commented on", withTitle: true };
    case "member_joined": return { text: "joined the Collection", withTitle: false };
    case "member_left": return { text: "left the Collection", withTitle: false };
    case "member_removed": return { text: `removed ${a.target?.isYou ? "you" : name(a.target)} from the Collection`, withTitle: false };
  }
}

// One line of activity. It has no links of its own, so a parent can make the whole row a link or a button.
export default function ActivityRow({ a, showCollection = false }: { a: ActivityEntry; showCollection?: boolean }) {
  const { icon: Icon, tone } = ICONS[a.type];
  const s = sentence(a);
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-8 flex-none items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-snug text-slate-600">
        <span className="break-all font-medium text-ink">{name(a.actor)}</span> {s.text}
        {s.withTitle && a.item && <span className="break-words font-medium text-ink"> “{a.item.title}”</span>}
<div className="mt-0.5 text-xs text-slate-400">
  {showCollection && a?.Collection?.name ? `${a.Collection.name} · ` : ""}
  {timeAgo(a.createdAt)}
</div>
      </div>
    </div>
  );
}