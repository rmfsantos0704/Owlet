import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Clock3, FileText, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import NewBriefModal from "../components/briefs/NewBriefModal";
import LoadingScreen from "../components/shared/LoadingScreen";
import CollectionTools from "../components/library/CollectionTools";
import { templateLabel } from "../components/briefs/Templates";
import { timeAgo } from "../utils/time";
import type { BriefSummary } from "../types";

const FILTERS = ["All briefs", "Drafts", "Ready"] as const;

// Every brief in one collection (/Collection/:id/briefs). Briefs are written from the collection's sources,
// and each claim links back to them. When AI is unavailable, a brief is built as an outline without AI.
export default function Briefs() {
  const { id: routeId } = useParams();
  const { collections, ready } = useCollections();
  const current = (collections ?? []).find((c) => c.id === routeId);
  const dialog = useDialog();
  const navigate = useNavigate();
  const collectionId = current?.id;
  const canEdit = !!current && current.role !== "viewer";

  const [briefs, setBriefs] = useState<BriefSummary[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All briefs");
  const [newOpen, setNewOpen] = useState(false);
  const latest = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    const id = collectionId;
    if (!id) return;
    try {
      const r = await api<{ briefs: BriefSummary[] }>(`/briefs?collectionId=${id}`);
      if (latest.current !== id) return;
      setBriefs(r.briefs);
      setError("");
    } catch (e) {
      if (latest.current === id) setError(e instanceof Error ? e.message : "Couldn't load briefs");
    }
  }, [collectionId]);

  useEffect(() => {
    latest.current = collectionId;
    setBriefs(null);
    setFilter("All briefs");
    void load();
  }, [collectionId, load]);

  async function remove(brief: BriefSummary) {
    const ok = await dialog.confirm({
      title: `Delete “${brief.title}”?`,
      message: "This can't be undone. Your sources and highlights are not affected.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/briefs/${brief.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      void dialog.alert({ title: "Couldn't delete the brief", message: e instanceof Error ? e.message : "Please try again." });
    }
  }

  if (!ready) return <LoadingScreen label="Loading your collections…" fill="page" />;
  if (!current) {
    return (
      <p className="text-sm text-slate-500">
        This collection doesn't exist or you don't have access to it.{" "}
        <Link to="/" className="font-semibold text-blue-700 hover:underline">Back to your library</Link>
      </p>
    );
  }
  if (error && !briefs) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!briefs) return <LoadingScreen label="Loading research briefs…" fill="page" />;

  const base = `/Collection/${current.id}/briefs`;
  const shown = briefs.filter((b) => (filter === "Drafts" ? b.status === "draft" : filter === "Ready" ? b.status === "ready" : true));
  const ready_ = briefs.filter((b) => b.status === "ready").length;
  const sourcesUsed = briefs.reduce((n, b) => n + b.sourceCount, 0);

  return (
    <div className="space-y-6">
      <CollectionTools collection={current} canExport={canEdit} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-2 text-blue-600">Research</div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Research briefs</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Turn the sources in {current.name} into structured writing. Every claim links back to the passage it came from.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setNewOpen(true)} className="btn-primary">
            <Plus className="size-4" /> New brief
          </button>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Briefs", value: briefs.length, icon: FileText },
          { label: "Ready to share", value: ready_, icon: BookOpen },
          { label: "Sources used", value: sourcesUsed, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center justify-between p-5">
            <div>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
            </div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon className="size-4" />
            </span>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-4">
          <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FileText className="mx-auto mb-3 size-6 text-slate-300" />
            <div className="text-sm font-medium text-slate-600">{briefs.length === 0 ? "No briefs yet" : "No briefs match this filter"}</div>
            <div className="mt-1 text-xs text-slate-400">
              {briefs.length === 0 && canEdit ? "Pick a template and some sources to write your first one." : "Try another filter."}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {shown.map((brief) => (
              <article key={brief.id} className="flex items-start gap-4 p-5 transition hover:bg-slate-50/70">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link to={`${base}/${brief.id}`} className="min-w-0 text-sm font-semibold text-slate-800 hover:text-blue-700">
                      {brief.title}
                    </Link>
                    <span className="flex items-center gap-1.5">
                      {brief.generator === "outline" && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">Outline</span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          brief.status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {brief.status === "ready" ? "Ready" : "Draft"}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{brief.question || templateLabel(brief.template)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>{templateLabel(brief.template)}</span>
                    <span>{brief.sourceCount} source{brief.sourceCount === 1 ? "" : "s"}</span>
                    <span>{brief.wordCount.toLocaleString()} words</span>
                    <span>Updated {timeAgo(brief.updatedAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => navigate(`${base}/${brief.id}`)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                      Open brief
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => remove(brief)}
                        aria-label={`Delete ${brief.title}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <NewBriefModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        collectionId={current.id}
        onCreated={(id) => {
          setNewOpen(false);
          navigate(`${base}/${id}`);
        }}
      />
    </div>
  );
}