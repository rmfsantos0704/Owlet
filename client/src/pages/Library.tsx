import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive, Bot, Copy, FileDown, Highlighter, LoaderCircle, MessageSquareText, Quote, Search, Settings, Tag, Upload, X, type LucideIcon,
} from "lucide-react";
import { put } from "@vercel/blob/client";
import { api, download } from "../services/api";
import type { ResearchItem } from "../types";
import ResearchCard from "../components/ResearchCard";
import SelectableClips from "../components/SelectableClips";
import { useCollections } from "../context/CollectionContext";
import CollectionExportMenu from "../components/CollectionExportMenu";
import AiAssistantCard from "../components/AiAssistantCard";
import Toast, { type Notice } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import RecentActivity from "../components/RecentActivity";

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024;
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: LucideIcon; accent: string }) {
  return (
    <div className="card p-3 sm:p-5">
      <div className="mb-3 flex items-start justify-between sm:mb-5">
        <span className="text-xs font-medium text-slate-500 sm:text-sm">{label}</span>
        <span className={`flex size-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-4.5" strokeWidth={1.9} />
        </span>
      </div>
      <span className="text-3xl font-semibold tracking-tight text-ink">{value}</span>
    </div>
  );
}

export default function Library({ all = false }: { all?: boolean }) {
  const { aiEnabled } = useAuth();
  const { current, ready, collections } = useCollections();
  const wid = all ? undefined : current?.id;
  const wsName = (id: string) => collections.find((w) => w.id === id)?.name;
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tag = params.get("tag") ?? "";
  const readingStatus = params.get("readingStatus") ?? "";
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [citationStyle, setCitationStyle] = useState<"apa" | "mla" | "chicago">("apa");
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
      if (readingStatus) p.set("readingStatus", readingStatus);

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
  }, [q, tag, readingStatus, wid, all, reloadKey]);

  function setTag(t: string) {
    const next = new URLSearchParams(params);
    if (t) next.set("tag", t);
    else next.delete("tag");
    setParams(next);
  }

  function setReadingStatus(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("readingStatus", value);
    else next.delete("readingStatus");
    setParams(next);
  }

  async function copyBibliography(selected: ResearchItem[]) {
    const references = selected
      .map((item) => item.citations?.[citationStyle]?.trim())
      .filter((reference): reference is string => !!reference)
      .sort((a, b) => a.localeCompare(b));
    if (!references.length) {
      setNotice({ text: "The selected clips don't have generated citations yet.", error: true });
      return;
    }
    try {
      await navigator.clipboard.writeText(references.join("\n\n"));
      setNotice({ text: `Copied ${references.length} ${citationStyle.toUpperCase()} reference${references.length === 1 ? "" : "s"}.`, error: false });
    } catch {
      setNotice({ text: "Couldn't access the clipboard. Check browser permissions and try again.", error: true });
    }
  }

  function exportSelectedRis(selected: ResearchItem[]) {
    const ids = selected.map((item) => item._id);
    const query = new URLSearchParams({ format: "ris", itemIds: ids.join(",") });
    download(`/research/export?${query}`, "owlet-selected.ris")
      .catch((cause) => setNotice({ text: cause instanceof Error ? cause.message : "RIS export failed.", error: true }));
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
        try {
          // Vercel rejects request bodies over ~4.5 MB, so the PDF goes straight to Blob storage,
          // and the server only gets its address
          const { pathname, clientToken } = await api<{ pathname: string; clientToken: string }>(
            "/research/import/token",
            { method: "POST" }
          );
          const blob = await put(pathname, f, {
            access: "public",
            token: clientToken,
            contentType: "application/pdf",
          });
          const r = await api<{ aiFailed: boolean }>("/research/import", {
            method: "POST",
            body: { collectionId: wid, blobUrl: blob.url, fileName: f.name },
          });
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

  const filtering = !!(q.trim() || tag || readingStatus);
  const stats = [
    { label: "Saved clips", value: items.length, icon: Archive, accent: "bg-blue-50 text-blue-700" },
    aiEnabled
      ? { label: "AI summaries", value: items.filter((i) => i.aiOutput.summary).length, icon: Bot, accent: "bg-violet-50 text-violet-700" }
      : { label: "Tagged clips", value: items.filter((i) => (i.tags?.length ?? 0) > 0).length, icon: Tag, accent: "bg-violet-50 text-violet-700" },
    { label: "Highlights", value: items.reduce((n, i) => n + (i.highlights?.length ?? 0), 0), icon: Highlighter, accent: "bg-amber-50 text-amber-700" },
    { label: "Comments", value: items.reduce((n, i) => n + (i.comments?.length ?? 0), 0), icon: MessageSquareText, accent: "bg-emerald-50 text-emerald-700" },
  ];

  if (!all && !ready) {
    return (
      <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <LoaderCircle className="size-6 animate-spin text-blue-600" aria-hidden="true" />
        <span>Loading your collections…</span>
      </div>
    );
  }

  if (!all && !current) {
    return <p className="text-red-600">Couldn't load your collections. Check that the server is running, then refresh.</p>;
  }

  const clipsCard = (
    <SelectableClips
      clips={items}
      getId={(it) => it._id}
      getLabel={(it) => it.source.title ?? "clip"}
      renderClip={(it) => (
        <ResearchCard item={it} onTag={setTag} collectionName={all ? wsName(it.collectionId) : undefined} />
      )}
      onDeleted={(ids) => {
        setItems((prev) => prev.filter((it) => !ids.includes(it._id)));
        setReloadKey((k) => k + 1); // refresh Recent activity
      }}
      onNotice={setNotice}
      title={filtering ? "Results" : "Recent clips"}
      subtitle={
        <>
          <span>{items.length} {items.length === 1 ? "clip" : "clips"}</span>
          {tag && (
            <button onClick={() => setTag("")} className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
              {tag} <X className="size-3" />
            </button>
          )}
        </>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by reading status"
            value={readingStatus}
            onChange={(e) => setReadingStatus(e.target.value)}
            className="field !w-auto !py-1.5 !text-xs"
          >
            <option value="">All reading statuses</option>
            <option value="to_read">To read</option>
            <option value="reading">Reading</option>
            <option value="done">Done</option>
          </select>
        </div>
      }
      selectionActions={(selected) => (
        <>
          <label className="sr-only" htmlFor="bibliography-style">Citation style</label>
          <div className="relative">
            <Quote aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <select
              id="bibliography-style"
              value={citationStyle}
              onChange={(event) => setCitationStyle(event.target.value as "apa" | "mla" | "chicago")}
              className="btn-secondary whitespace-nowrap !rounded-lg !py-2 !pl-7 !pr-2 !text-xs"
            >
              <option value="apa">APA</option>
              <option value="mla">MLA</option>
              <option value="chicago">Chicago</option>
            </select>
          </div>
          <button type="button" onClick={() => void copyBibliography(selected)} disabled={!selected.length} title="Copy references" aria-label="Copy references" className="btn-secondary size-9 !rounded-lg !p-0">
            <Copy aria-hidden="true" className="size-3.5" />
          </button>
          <button type="button" onClick={() => exportSelectedRis(selected)} disabled={!selected.length} title="Export RIS" aria-label="Export RIS" className="btn-secondary size-9 !rounded-lg !p-0">
            <FileDown aria-hidden="true" className="size-3.5" />
          </button>
        </>
      )}
      // viewers can't delete; in "All clips" the role differs per clip, so the server decides
      canSelect={all || (!!current && current.role !== "viewer")}
      loading={loading}
      error={error}
      resetKey={`${q}|${tag}|${readingStatus}|${wid ?? ""}|${all}`}
      empty={
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
      }
    />
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

      <section className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row">
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
          <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
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

            <RecentActivity collectionId={current.id} reloadKey={reloadKey} />

            <Link to={`/Collection/${current.id}/settings`} className="btn-secondary">
              <Settings className="size-4" />
            </Link>
          </div>
        )}
      </section>

      {!filtering && items.length > 0 && (
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} />)}
        </section>
      )}

      {!all && current ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {clipsCard}
          </div>
          <div className="space-y-6">
            <AiAssistantCard items={items} />
          </div>
        </div>
      ) : (
        clipsCard
      )}

      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}