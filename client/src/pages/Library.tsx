import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive, Bot, FileDown, Highlighter, MessageSquareText, Search, Settings, Upload, X, type LucideIcon,
} from "lucide-react";
import { api, download, upload } from "../services/api";
import type { ResearchItem } from "../types";
import ResearchCard from "../components/ResearchCard";
import { useCollections } from "../context/CollectionContext";
import CollectionExportMenu from "../components/CollectionExportMenu";
import CopyCollectionLink from "../components/CopyCollectionLink";
import RecentActivity from "../components/RecentActivity";

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024;
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

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

export default function Library({ all = false }: { all?: boolean }) {
  const { current, ready, collections } = useCollections();
  const wid = all ? undefined : current?.id;
  const wsName = (id: string) => collections.find((w) => w.id === id)?.name;
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const importRef = useRef<(files: File[]) => void>(() => {});

  const canImport = !all && !!current && current.role !== "viewer";

  useEffect(() => {
    if (!all && !wid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      if (wid) p.set("collectionId", wid);
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
  }, [q, tag, wid, all, reloadKey]);

  function setTag(t: string) {
    const next = new URLSearchParams(params);
    if (t) next.set("tag", t);
    else next.delete("tag");
    setParams(next);
  }

  function exportAs(format: "bibtex" | "csv" | "json") {
    const p = new URLSearchParams({ format });
    if (wid) p.set("collectionId", wid);
    if (q.trim()) p.set("q", q.trim());
    if (tag) p.set("tag", tag);
    download(`/research/export?${p}`, `owlet-export.${format === "bibtex" ? "bib" : format}`)
      .catch((e) => setError(e.message));
  }

  async function importFiles(picked: File[]) {
    if (!wid || busyRef.current) return;

    const problems: string[] = [];
    const pdfs = picked.filter(isPdf);
    const skipped = picked.length - pdfs.length;
    if (skipped) problems.push(`${skipped} non-PDF ${skipped === 1 ? "file was" : "files were"} skipped`);
    if (!pdfs.length) {
      setNotice({ text: problems.join(" · ") || "No PDF files selected.", error: true });
      return;
    }
    if (pdfs.length > MAX_FILES) problems.push(`Only the first ${MAX_FILES} PDFs were used`);
    const files = pdfs.slice(0, MAX_FILES);

    busyRef.current = true;
    let ok = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setImporting(`Importing ${i + 1} of ${files.length}…`);
        if (f.size > MAX_BYTES) {
          problems.push(`${f.name}: too large (15 MB max)`);
          continue;
        }
        const form = new FormData();
        form.append("collectionId", wid);
        form.append("file", f);
        try {
          const r = await upload<{ aiFailed: boolean }>("/research/import", form);
          ok++;
          if (r.aiFailed) problems.push(`${f.name}: saved, but the AI summary failed`);
        } catch (e) {
          problems.push(`${f.name}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
    } finally {
      busyRef.current = false;
      setImporting("");
      if (fileRef.current) fileRef.current.value = "";
    }

    setNotice({
      text: `${ok} of ${files.length} imported.${problems.length ? " " + problems.join(" · ") : ""}`,
      error: ok === 0,
    });
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    importRef.current = importFiles;
  });

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");

    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      if (canImport) setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (!canImport) {
        setNotice({ text: "Open a Collection where you're an owner or editor to import PDFs.", error: true });
        return;
      }
      importRef.current(e.dataTransfer ? Array.from(e.dataTransfer.files) : []);
    };

    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [canImport]);

  const filtering = !!(q.trim() || tag);
  const stats = [
    { label: "Saved clips", value: items.length, icon: Archive, accent: "bg-blue-50 text-blue-700" },
    { label: "AI summaries", value: items.filter((i) => i.aiOutput.summary).length, icon: Bot, accent: "bg-violet-50 text-violet-700" },
    { label: "Highlights", value: items.reduce((n, i) => n + (i.highlights?.length ?? 0), 0), icon: Highlighter, accent: "bg-amber-50 text-amber-700" },
    { label: "Comments", value: items.reduce((n, i) => n + (i.comments?.length ?? 0), 0), icon: MessageSquareText, accent: "bg-emerald-50 text-emerald-700" },
  ];

  if (!all && ready && !current) {
    return <p className="text-red-600">Couldn't load your collections. Check that the server is running, then refresh.</p>;
  }

  const clipsCard = (
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
            {filtering
              ? "Try another search or filter."
              : canImport
                ? "Clip a page with the Owlet extension, or drop PDFs anywhere on this page."
                : "Clip a page with the Owlet extension."}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((it) => (
            <ResearchCard key={it._id} item={it} onTag={setTag} collectionName={all ? wsName(it.collectionId) : undefined} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="rounded-3xl border-2 border-dashed border-cyan-300 bg-white px-10 py-12 text-center shadow-2xl">
            <Upload className="mx-auto mb-3 size-8 text-blue-600" />
            <div className="text-lg font-semibold text-ink">Drop PDFs to import</div>
            <div className="mt-1 text-sm text-slate-500">
              into {current?.name} · up to {MAX_FILES} files, 15 MB each
            </div>
          </div>
        </div>
      )}

      <section className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {all ? "All clips" : current?.name ?? "Your library"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {all ? "Clips from every Collection you belong to." : current?.description || "Articles, papers, and PDFs you've clipped."}
          </p>
        </div>
        {!all && current && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {canImport && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => importFiles(Array.from(e.target.files ?? []))}
                />
                <button onClick={() => fileRef.current?.click()} disabled={!!importing} className="btn-primary">
                  <Upload className="size-4" /> {importing || "Import PDF"}
                </button>
                 <CollectionExportMenu collectionId={current.id} collectionName={current.name} />
              </>
            )}
            {current.role === "owner" && !current.isDefault && <CopyCollectionLink key={current.id} Collection={current} />}
            <Link to={`/Collection/${current.id}/settings`} className="btn-secondary">
              <Settings className="size-4" /> Settings
            </Link>
          </div>
        )}
      </section>

      {notice && (
        <div
          className={`mb-6 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span className="min-w-0 break-words">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      {!filtering && items.length > 0 && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </section>
      )}

      {!all && current ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {clipsCard}
          </div>
          <div>
            <RecentActivity collectionId={current.id} reloadKey={reloadKey} />
          </div>
        </div>
      ) : (
        clipsCard
      )}
    </div>
  );
}