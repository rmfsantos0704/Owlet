import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check, ChevronLeft, ChevronRight, FileDown, FileText, Highlighter, Loader2, MessageSquareText,
  RefreshCw, Settings, Sparkles, Trash2,
} from "lucide-react";
import { api, download } from "../services/api";
import CitationBox from "../components/CitationBox";
import TagInput from "../components/TagInput";
import HighlightList from "../components/HighlightList";
import ClippedText from "../components/ClippedText";
import DraggableModal from "../components/DraggableModal";

import CommentThread from "../components/CommentThread";
import SourceEditor from "../components/SourceEditor";
import AiSettingsModal from "../components/AiSettingsModal";
import RegenerateModal from "../components/RegenerateModal";
import Modal from "../components/Modal";
import { DEFAULT_AI_SETTINGS } from "../types";
import type { AiSettings, ResearchItem, Role } from "../types";

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done">("idle"); // drives the Download PDF button

  useEffect(() => {
    api<{ item: ResearchItem; role: Role | null }>(`/research/${id}`)
      .then((r) => {
        setItem(r.item);
        setRole(r.role);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function act(path: string, method: string, body?: unknown) {
    try {
      const changed = await api<Partial<ResearchItem>>(`/research/${id}${path}`, { method, body });
      setItem((prev) => (prev ? { ...prev, ...changed } : prev));
      setActionError("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  // for handlers that don't need to react to failure (the error is already shown)
  const run = (path: string, method: string, body?: unknown) => act(path, method, body).catch(() => {});

  // Rewrites the summary. With `settings` (from the modal), the server saves them on the clip first.
  async function regenerate(settings?: AiSettings) {
    setRegenerating(true);
    await run("/regenerate", "POST", settings ? { aiSettings: settings } : undefined);
    setRegenerating(false);
  }

  // throws on failure so the modal can show the error
  const saveAiSettings = (aiSettings: AiSettings) => act("/ai-settings", "PUT", { aiSettings });

  // navigate(-1) does nothing when this page was opened in a fresh tab (e.g. from the extension),
  // because there is no earlier history entry. React Router stores the entry index in history.state.idx.
  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/"); // change to your collection route, e.g. `/collections/${item?.collectionId}`
  }

  async function remove() {
    if (!confirm("Delete this clip?")) return;
    try {
      await api(`/research/${id}`, { method: "DELETE" });
      goBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function downloadPdf() {
    if (pdfState === "loading") return;
    const name = (item?.source.title ?? "owlet-brief").replace(/[^\w]+/g, "-").slice(0, 60);
    setPdfState("loading");
    setActionError("");
    try {
      await download(`/research/${id}/pdf`, `${name}.pdf`);
      setPdfState("done");
      setTimeout(() => setPdfState("idle"), 2500); // show "Downloaded" briefly
    } catch (e) {
      setPdfState("idle");
      setActionError(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!item || !id) return <p className="text-slate-400">Loading…</p>;

  const canEdit = role === "owner" || role === "editor";
  const isPdf = item.source.kind === "pdf";
  const aiSettings = item.aiSettings ?? DEFAULT_AI_SETTINGS;
  const textLabel = isPdf ? "Extracted text" : "Clipped text";
  const wordCount = item.content?.wordCount ?? 0;
  // only real web links become clickable; anything else (e.g. a javascript: address) is shown as plain text
  const safeUrl = item.source.url && /^https?:\/\//i.test(item.source.url) ? item.source.url : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={goBack} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand">
          <ChevronLeft className="size-4" /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHighlightsOpen(true)}
            title={`Highlights (${item.highlights.length})`}
            aria-label={`View highlights (${item.highlights.length})`}
            className="relative flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition hover:bg-amber-100"
          >
            <Highlighter className="size-5" />
            {item.highlights.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {item.highlights.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            title={`Comments (${item.comments.length})`}
            aria-label={`Open comments (${item.comments.length})`}
            className="relative flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
          >
            <MessageSquareText className="size-5" />
            {item.comments.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-emerald-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {item.comments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfState === "loading"}
            aria-live="polite"
            className="btn-secondary disabled:cursor-wait disabled:opacity-80"
          >
            {pdfState === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : pdfState === "done" ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <FileDown className="size-4" />
            )}
            {pdfState === "loading" ? "Downloading…" : pdfState === "done" ? "Downloaded" : "Download PDF"}
          </button>
          {canEdit && (
            <button type="button" onClick={remove} className="btn-danger" title="Delete clip">
              <Trash2 className="size-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6">
            {safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 hover:underline"
              >
                {item.source.domain}
              </a>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                {isPdf ? `PDF${item.source.fileName ? ` · ${item.source.fileName}` : ""}` : "Clip"}
              </span>
            )}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{item.source.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {[item.source.author, item.source.publishedDate].filter(Boolean).join(" · ") || "No author or date yet"}
            </p>
            {canEdit && <SourceEditor source={item.source} onSave={(v) => act("/source", "PATCH", v)} />}
            <div className="mt-4">
              <TagInput tags={item.tags} readOnly={!canEdit} onChange={(tags) => run("/tags", "PUT", { tags })} />
            </div>
          </section>

          <section className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                  <Sparkles className="size-5" />
                </div>
                <h2 className="font-semibold">AI summary</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAiSettingsOpen(true)}
                  title="AI summary settings for this clip"
                  aria-label="AI summary settings"
                  className="inline-flex items-center justify-center rounded-lg bg-white/10 p-1.5 text-white transition hover:bg-white/20"
                >
                  <Settings className="size-4" />
                </button>
                {canEdit && (
                  <button
                    onClick={() => setRegenOpen(true)}
                    disabled={regenerating}
                    title="Rewrite using this clip's AI settings"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                    {regenerating ? "Regenerating…" : "Regenerate"}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/90">
              {item.aiOutput.summary || "No AI summary for this clip."}
            </p>
            {item.aiOutput.paraphrase && (
              <>
                <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  Key arguments (paraphrased)
                </div>
                <p className="mt-2 text-sm leading-relaxed text-blue-100/80">{item.aiOutput.paraphrase}</p>
              </>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold text-ink">Citations</h2>
            <CitationBox label="APA" text={item.citations.apa ?? ""} />
            <CitationBox label="MLA" text={item.citations.mla ?? ""} />
            <CitationBox label="Chicago" text={item.citations.chicago ?? ""} />
            <p className="text-[11px] text-slate-400">
              Auto-generated from the {isPdf ? "file's details" : "page's details"}. Verify before submitting
              {canEdit ? ", and use Edit details to correct them." : "."}
            </p>
          </section>

          <section className="card p-5">
            <button
              type="button"
              onClick={() => setTextOpen(true)}
              aria-label={`Open ${textLabel.toLowerCase()}`}
              className="group flex w-full items-center gap-3 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{textLabel}</span>
                <span className="block text-xs text-slate-500">
                  {wordCount} words · {canEdit ? "Read and highlight" : "Read"}
                </span>
              </span>
              <ChevronRight className="size-4 text-slate-300 transition group-hover:text-blue-500" />
            </button>
          </section>
        </div>
      </div>

      <Modal
        open={textOpen}
        onClose={() => setTextOpen(false)}
        title={`${textLabel} (${wordCount} words)`}
        maxWidth="max-w-5xl"
      >
        <ClippedText
          text={item.content?.rawText ?? ""}
          highlights={item.highlights}
          readOnly={!canEdit}
          onHighlight={(text, color, note) => act("/highlights", "POST", { text, color, note })}
        />
      </Modal>

      <DraggableModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        title={`Comments (${item.comments.length})`}
        scroll={false}
      >
        {/* CommentThread pins its composer and scrolls its own list */}
        <CommentThread
          comments={item.comments}
          highlights={item.highlights}
          readOnly={!canEdit}
          onAdd={(text, highlightId, parentId) => act("/comments", "POST", { text, highlightId, parentId })}
          onEdit={(cid, text) => act(`/comments/${cid}`, "PATCH", { text })}
          onDelete={(cid) => run(`/comments/${cid}`, "DELETE")}
        />
      </DraggableModal>

      <AiSettingsModal
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        itemId={id}
        settings={aiSettings}
        canEdit={canEdit}
        onSave={saveAiSettings}
        onRegenerate={regenerate}
      />

      <Modal
        open={highlightsOpen}
        onClose={() => setHighlightsOpen(false)}
        title={`Highlights (${item.highlights.length})`}
        maxWidth="max-w-xl"
      >
        <HighlightList
          highlights={item.highlights}
          comments={item.comments}
          readOnly={!canEdit}
          onEdit={(hid, color, note) => act(`/highlights/${hid}`, "PATCH", { color, note })}
          onDelete={(hid) => run(`/highlights/${hid}`, "DELETE")}
        />
      </Modal>

      <RegenerateModal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        settings={aiSettings}
        onConfirm={() => {
          setRegenOpen(false);
          void regenerate();
        }}
        onEditSettings={() => {
          setRegenOpen(false);
          setAiSettingsOpen(true);
        }}
      />
    </div>
  );
}