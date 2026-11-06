import { Link } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import type { ResearchItem } from "../../types";
import { timeAgo } from "../../utils/time";

const PALETTES = [
  "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
];
const palette = (s = "") => PALETTES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length];
const STATUS_LABELS = { to_read: "To read", reading: "Reading", done: "Done" } as const;

type Props = {
  item: ResearchItem;
  onTag: (t: string) => void;
  collectionName?: string;
};

export default function ResearchCard({ item, onTag, collectionName }: Props) {
  const isPdf = item.source.kind === "pdf";
  const origin = isPdf ? `PDF${item.source.fileName ? ` · ${item.source.fileName}` : ""}` : item.source.domain;
  const summary = item.aiOutput?.summary;
  const words = item.content?.wordCount ?? 0;
  const highlights = item.highlights?.length ?? 0;
  const comments = item.comments?.length ?? 0;

  return (
    <div className="flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:gap-4 sm:px-5">
      <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 ${palette(item.source.domain ?? item.source.fileName)}`}>
        <FileText className="size-4.5" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/item/${item._id}`} className="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-blue-700">
            {item.source.title || item.source.url || item.source.fileName}
          </Link>
          <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-400">
          {collectionName && <span className="font-medium text-slate-500">{collectionName} · </span>}
          {origin}
          {item.source.author && ` · ${item.source.author}`}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="chip">{STATUS_LABELS[item.readingStatus ?? "to_read"]}</span>
          {item.personalNote && <span className="text-xs italic text-slate-500">Saved because: {item.personalNote}</span>}
        </div>
        {item.userSummary && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">My summary: </span>{item.userSummary}
          </p>
        )}
        {summary && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{summary}</p>}
        {item.snippet && (
          <p className="mt-1.5 line-clamp-2 text-xs italic leading-5 text-slate-500">…{item.snippet}…</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {(item.tags ?? []).map((t) => (
            <button key={t} onClick={() => onTag(t)} className="chip hover:bg-slate-200">
              {t}
            </button>
          ))}
          {summary && (
            <span className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <Sparkles className="size-3" /> Summarized
            </span>
          )}
        </div>
        {(words > 0 || highlights > 0 || comments > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            {words > 0 && <span>{words.toLocaleString()} words</span>}
            {highlights > 0 && (
              <span>
                {highlights} highlight{highlights === 1 ? "" : "s"}
              </span>
            )}
            {comments > 0 && (
              <span>
                {comments} comment{comments === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}