import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Highlighter, MessageSquareText, FileText } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import type { ResearchItem } from "../types";

const COLORS: Record<string, string> = {
  yellow: "border-l-amber-400 bg-amber-50/45",
  green: "border-l-emerald-500 bg-emerald-50/45",
  blue: "border-l-blue-500 bg-blue-50/45",
  pink: "border-l-pink-400 bg-pink-50/45",
};
const FILTERS = ["All highlights", "With notes"] as const;

export default function Highlights() {
  const { current, ready } = useCollections();
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").toLowerCase();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All highlights");

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    const qs = current ? `?collectionId=${current.id}` : "";
    api<{ items: ResearchItem[] }>(`/research${qs}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load highlights"))
      .finally(() => setLoading(false));
  }, [ready, current?.id]);

  const all = useMemo(
    () =>
      items
        .flatMap((item) =>
          (item.highlights ?? []).map((h) => ({
            ...h,
            item,
            commentCount: (item.comments ?? []).filter((c) => c.highlightId === h._id).length,
          }))
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [items]
  );

  const shown = all.filter(
    (h) =>
      (filter === "All highlights" || !!h.note) &&
      (!q || h.text.toLowerCase().includes(q) || (h.note ?? "").toLowerCase().includes(q) || (h.item.source?.title ?? "").toLowerCase().includes(q))
  );

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((h) => h.item.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [all]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = [
    ["This week", all.filter((h) => +new Date(h.createdAt) > weekAgo).length],
    ["With notes", all.filter((h) => h.note).length],
    ["Total", all.length],
  ];

  return (
    <div>
      <section className="mb-8">
        <div className="eyebrow mb-2 text-amber-600">Knowledge library</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Highlights</h1>
        <p className="mt-2 text-sm text-slate-500">
          {all.length} passages collected from {new Set(all.map((h) => h.item._id)).size} sources
          {current ? ` in ${current.name}` : ""}.
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-ink">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    filter === f ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="px-5 py-16 text-center text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="px-5 py-16 text-center text-sm text-red-600">{error}</p>
          ) : shown.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Highlighter className="mx-auto mb-3 size-6 text-slate-300" />
              <div className="text-sm font-medium text-slate-600">No highlights yet</div>
              <div className="mt-1 text-xs text-slate-400">Open a clip and select text to highlight it.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map((h) => (
                <article key={`${h.item._id}-${h._id}`} className="p-5 sm:p-6">
                  <div className={`rounded-r-xl border-l-4 p-4 ${COLORS[h.color] ?? COLORS.yellow}`}>
                    <p className="text-sm font-medium leading-6 text-slate-700">“{h.text}”</p>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link to={`/item/${h.item._id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-700">
                        {h.item.source?.title ?? "Untitled"}
                      </Link>
                      <div className="mt-1 text-xs text-slate-400">
                        {h.item.source?.domain ?? h.item.source?.fileName ?? "Source"} · Highlighted{" "}
                        {new Date(h.createdAt).toLocaleDateString()}
                      </div>
                      {h.item.tags?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {h.item.tags.map((t) => (
                            <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/item/${h.item._id}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      <MessageSquareText className="size-3.5" />
                      {h.commentCount}
                    </Link>
                  </div>
                  {h.note && (
                    <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                      <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-semibold text-slate-700">Your note:</span> {h.note}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="mb-4 font-semibold text-ink">Popular topics</h2>
            {topTags.length === 0 ? (
              <p className="text-xs text-slate-400">Tags from highlighted clips show up here.</p>
            ) : (
              <div className="space-y-3">
                {topTags.map(([tag, n]) => (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-blue-500" />
                    <span className="flex-1 text-xs font-medium text-slate-600">{tag}</span>
                    <span className="text-[11px] text-slate-400">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-brand p-5 text-white">
            <h2 className="font-semibold">Connect the patterns</h2>
            <p className="mt-2 text-xs leading-5 text-blue-100/70">
              Ask Owlet to synthesize your sources into themes, claims, and open questions.
            </p>
            <Link
              to="/ai"
              className="mt-4 block w-full rounded-xl bg-white py-2.5 text-center text-xs font-bold text-brand hover:bg-blue-50"
            >
              Open AI workspace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}