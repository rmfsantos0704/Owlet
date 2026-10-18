import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, Bot, FileDown, Highlighter, MessageSquareText, Search, X, type LucideIcon } from "lucide-react";
import { api, download } from "../services/api";
import type { ResearchItem } from "../types";
import ResearchCard from "../components/ResearchCard";
import { useWorkspaces } from "../context/WorkspaceContext";

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: LucideIcon; accent: string }) {
  return (
    <div className="card p-5">
      <div className="mb-5 flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`flex size-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-4.5" strokeWidth={1.9} />
        </span>
      </div>
      <span className="text-3xl font-semibold tracking-tight text-ink">{value}</span>
    </div>
  );
}

export default function Library() {
  const { current, ready } = useWorkspaces();
  const wid = current?.id;
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!wid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      const p = new URLSearchParams({ workspaceId: wid });
      if (q.trim()) p.set("q", q.trim());
      if (tag) p.set("tag", tag);

      api<{ items: ResearchItem[] }>(`/research?${p}`)
        .then((res) => {
          if (!cancelled) setItems(res.items);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, tag, wid]);

  function setTag(t: string) {
    const next = new URLSearchParams(params);
    if (t) next.set("tag", t);
    else next.delete("tag");
    setParams(next);
  }

  function exportAs(format: "bibtex" | "csv" | "json") {
    const p = new URLSearchParams({ format });
    if (wid) p.set("workspaceId", wid);
    if (q.trim()) p.set("q", q.trim());
    if (tag) p.set("tag", tag);
    download(`/research/export?${p}`, `owlet-export.${format === "bibtex" ? "bib" : format}`)
      .catch((e) => setError(e.message));
  }

  const filtering = !!(q.trim() || tag);
  const stats = [
    { label: "Saved clips", value: items.length, icon: Archive, accent: "bg-blue-50 text-blue-700" },
    { label: "AI summaries", value: items.filter((i) => i.aiOutput.summary).length, icon: Bot, accent: "bg-violet-50 text-violet-700" },
    { label: "Highlights", value: items.reduce((n, i) => n + (i.highlights?.length ?? 0), 0), icon: Highlighter, accent: "bg-amber-50 text-amber-700" },
    { label: "Comments", value: items.reduce((n, i) => n + (i.comments?.length ?? 0), 0), icon: MessageSquareText, accent: "bg-emerald-50 text-emerald-700" },
  ];

  if (ready && !current) {
    return <p className="text-red-600">Couldn't load your workspaces. Check that the server is running, then refresh.</p>;
  }

  return (
    <div>
      <section className="mb-8">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{current?.name ?? "Your library"}</h1>
        <p className="mt-2 text-sm text-slate-500">{current?.description || "Articles and papers you've clipped."}</p>
      </section>

      {!filtering && items.length > 0 && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">{filtering ? "Results" : "Recent clips"}</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>{items.length} {items.length === 1 ? "clip" : "clips"}</span>
              {tag && (
                <button onClick={() => setTag("")} className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                  {tag} <X className="size-3" />
                </button>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <FileDown className="ml-2 size-3.5 text-slate-400" />
              {(["bibtex", "csv", "json"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => exportAs(f)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-brand hover:shadow-sm"
                >
                  {f === "bibtex" ? "BibTeX" : f.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="px-5 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Search className="mx-auto mb-3 size-6 text-slate-300" />
            <div className="text-sm font-medium text-slate-600">{filtering ? "No matching clips" : "No clips yet"}</div>
            <div className="mt-1 text-xs text-slate-400">
              {filtering ? "Try another search or filter." : "Clip a page with the Owlet extension."}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((it) => <ResearchCard key={it._id} item={it} onTag={setTag} />)}
          </div>
        )}
      </div>
    </div>
  );
}