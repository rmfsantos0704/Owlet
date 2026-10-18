import { Link } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import type { ResearchItem } from "../types";
import { timeAgo } from "../utils/time";

const PALETTES = [
  "bg-sky-50 text-sky-700",
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
];
const palette = (s = "") => PALETTES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length];

export default function ResearchCard({ item, onTag }: { item: ResearchItem; onTag: (t: string) => void }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50/80">
      <div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${palette(item.source.domain)}`}>
        <FileText className="size-4.5" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/item/${item._id}`} className="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-blue-700">
            {item.source.title || item.source.url}
          </Link>
          <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {item.source.domain}
          {item.source.author && ` · ${item.source.author}`}
        </div>
        {item.aiOutput.summary && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.aiOutput.summary}</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {item.tags.map((t) => (
            <button key={t} onClick={() => onTag(t)} className="chip hover:bg-slate-200">
              {t}
            </button>
          ))}
          {item.aiOutput.summary && (
            <span className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
              <Sparkles className="size-3" /> Summarized
            </span>
          )}
        </div>
      </div>
    </div>
  );
}