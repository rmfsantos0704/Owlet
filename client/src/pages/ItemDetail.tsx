import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Check, ChevronLeft, ChevronRight, FileDown, FileText, Highlighter, Loader2, MessageSquareText,
  Pencil, RefreshCw, Save, Settings, Sparkles, Trash2, X,
} from "lucide-react";
import { api, download, AI_USAGE_UPDATED_EVENT } from "../services/api";
import CitationBox from "../components/itemdetail/CitationBox";
import TagInput from "../components/itemdetail/TagInput";
import HighlightList from "../components/itemdetail/HighlightList";
import ClippedText from "../components/itemdetail/ClippedText";
import DraggableModal from "../components/shared/DraggableModal";
import { useAuth } from "../context/AuthContext";
import QuickSummary from "../components/itemdetail/QuickSummary";
import CommentThread from "../components/itemdetail/CommentThread";
import SourceEditor from "../components/itemdetail/SourceEditor";
import AiSettingsModal from "../components/itemdetail/AiSettingsModal";
import RegenerateModal from "../components/itemdetail/RegenerateModal";
import Modal from "../components/shared/Modal";
import LoadingScreen from "../components/shared/LoadingScreen";
import RelatedClips from "../components/itemdetail/RelatedClips";
import type { LayoutContext } from "../components/Layout";
import { DEFAULT_AI_SETTINGS } from "../types";
import type { AiSettings, ResearchItem, Role } from "../types";

// the citation details that "Find missing details" can propose
const DETAIL_LABEL: Record<string, string> = {
  author: "Author",
  publishedDate: "Date",
  journal: "Journal",
  volume: "Volume",
  issue: "Issue",
  pages: "Pages",
  doi: "DOI",
};
type DetailSuggestions = { suggestions: Record<string, string>; ai: "used" | "off" | "quota" | "failed" | "skipped" };

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { aiEnabled } = useAuth();
  const layout = useOutletContext<LayoutContext | undefined>();
  const headerActions = layout?.headerActions ?? null; // the spot in the top bar for this page's buttons
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [editingAiOutput, setEditingAiOutput] = useState(false);
  const [aiSummaryDraft, setAiSummaryDraft] = useState("");
  const [aiParaphraseDraft, setAiParaphraseDraft] = useState("");
  const [savingAiOutput, setSavingAiOutput] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [readingNotesOpen, setReadingNotesOpen] = useState(false);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done">("idle"); // drives the Download PDF button
  const [readingStatus, setReadingStatus] = useState<"to_read" | "reading" | "done">("to_read");
  const [userSummary, setUserSummary] = useState("");
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [finding, setFinding] = useState(false); // "Find missing details" is running
  const [found, setFound] = useState<DetailSuggestions | null>(null);
  const [foundPicked, setFoundPicked] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api<{ item: ResearchItem; role: Role | null }>(`/research/${id}`)
      .then((r) => {
        setItem(r.item);
        setRole(r.role);
        setReadingStatus(r.item.readingStatus ?? "to_read");
        setUserSummary(r.item.userSummary ?? "");
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

  async function saveHighlight(
    text: string,
    color: string,
    note?: string,
    offsets?: { startOffset: number; endOffset: number },
    existingHighlightId?: string
  ) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const existing = item?.highlights.find((highlight) => highlight._id === existingHighlightId) ?? item?.highlights.find((highlight) => {
      const hasSelectionOffsets = offsets && offsets.endOffset > offsets.startOffset;
      const hasHighlightOffsets =
        Number.isInteger(highlight.startOffset) &&
        Number.isInteger(highlight.endOffset) &&
        highlight.endOffset! > highlight.startOffset!;
      if (hasSelectionOffsets && hasHighlightOffsets) {
        return offsets.startOffset < highlight.endOffset! && offsets.endOffset > highlight.startOffset!;
      }
      return highlight.text.replace(/\s+/g, " ").trim() === normalizedText;
    });

    if (existing) {
      await act(`/highlights/${existing._id}`, "PATCH", {
        color,
        note: note?.trim() || existing.note || "",
        text,
        ...offsets,
      });
      return;
    }

    await act("/highlights", "POST", { text, color, note, ...offsets });
  }

  // Proposes author, date, DOI and so on from the clip's own text. Nothing is saved until the person applies it,
  // and applying goes through the normal source save, so the APA, MLA and Chicago citations are rebuilt from it.
  async function findDetails() {
    setFinding(true);
    setActionError("");
    try {
      const r = await api<DetailSuggestions>(`/research/${id}/source/suggest`, { method: "POST" });
      setFound(r);
      setFoundPicked(Object.keys(r.suggestions));
      if (r.ai === "used") window.dispatchEvent(new Event(AI_USAGE_UPDATED_EVENT));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't look for details");
    } finally {
      setFinding(false);
    }
  }

  async function applyFound() {
    if (!found || !item) return;
    const chosen = Object.fromEntries(Object.entries(found.suggestions).filter(([field]) => foundPicked.includes(field)));
    if (!Object.keys(chosen).length) return setFound(null);
    const s = item.source;
    setApplying(true);
    try {
      await act("/source", "PATCH", {
        title: s.title, author: s.author, publishedDate: s.publishedDate, journal: s.journal,
        volume: s.volume, issue: s.issue, pages: s.pages, doi: s.doi,
        ...chosen,
      });
      setFound(null);
    } catch {
      // act() reports the failure in the page-level action error.
    } finally {
      setApplying(false);
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

  function editAiOutput() {
    setAiSummaryDraft(item?.aiOutput?.summary ?? "");
    setAiParaphraseDraft(item?.aiOutput?.paraphrase ?? "");
    setEditingAiOutput(true);
  }

  async function saveAiOutput() {
    setSavingAiOutput(true);
    try {
      await act("/ai-output", "PATCH", { summary: aiSummaryDraft, paraphrase: aiParaphraseDraft });
      setEditingAiOutput(false);
    } catch {
      // act() reports the failure in the page-level action error.
    } finally {
      setSavingAiOutput(false);
    }
  }

  async function saveWorkflow() {
    setWorkflowSaving(true);
    try {
      await act("/workflow", "PATCH", { readingStatus, userSummary });
      return true;
    } catch {
      // act() reports the failure in the page-level action error.
      return false;
    } finally {
      setWorkflowSaving(false);
    }
  }

  // Back always goes to the library at "/", where the collections are. navigate(-1) can't be trusted here: after a
  // visit to the PDF reader the previous history entry is the reader itself, so Back and Back again ping-pong.
  // (Collections don't have their own URL, so there is no per-collection path to go to.)
  function goBack() {
    navigate("/");
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
  if (!item || !id) return <LoadingScreen label="Opening your clip…" fill="page" />;

  const canEdit = role === "owner" || role === "editor";
  const isPdf = item.source.kind === "pdf";
  const pdfUrl = isPdf ? item.source.fileUrl : undefined;
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
      </div>

      {/* this clip's actions, shown in the top bar (labels appear on wide screens) */}
      {headerActions &&
        createPortal(
          <>
            <button
              type="button"
              onClick={() => setHighlightsOpen(true)}
              title={`Highlights (${item.highlights.length})`}
              aria-label={`View highlights (${item.highlights.length})`}
              className="relative flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
            >
              <Highlighter className="size-4.5" />
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
              className="relative flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
            >
              <MessageSquareText className="size-4.5" />
              {item.comments.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-emerald-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {item.comments.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setReadingNotesOpen(true)}
              title="Reading notes"
              aria-label="Open reading notes"
              className="btn-secondary !px-3 !py-2"
            >
              <FileText className="size-4" />
              <span className="hidden 2xl:inline">Reading notes</span>
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfState === "loading"}
              aria-live="polite"
              title="Download PDF"
              aria-label="Download PDF"
              className="btn-secondary !px-3 !py-2 disabled:cursor-wait disabled:opacity-80"
            >
              {pdfState === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : pdfState === "done" ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <FileDown className="size-4" />
              )}
              <span className={pdfState === "idle" ? "hidden 2xl:inline" : ""}>
                {pdfState === "loading" ? "Downloading…" : pdfState === "done" ? "Downloaded" : "Download PDF"}
              </span>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={remove}
                className="btn-danger !px-3 !py-2"
                title="Delete clip"
                aria-label="Delete clip"
              >
                <Trash2 className="size-4" />
                <span className="hidden 2xl:inline">Delete</span>
              </button>
            )}
          </>,
          headerActions
        )}

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
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>{[item.source.author, item.source.publishedDate].filter(Boolean).join(" · ") || "No author or date yet"}</span>
              {canEdit && !found && (!item.source.author || !item.source.publishedDate) && (
                <button
                  type="button"
                  onClick={findDetails}
                  disabled={finding}
                  title="Look for the author, date and DOI in this clip's text"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-60"
                >
                  {finding ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {finding ? "Looking…" : "Find missing details"}
                </button>
              )}
            </p>
            {(item.source.journal || item.source.doi) && (
              <p className="mt-1 text-xs text-slate-400">
                {[item.source.journal, item.source.volume && `Vol. ${item.source.volume}`, item.source.issue && `No. ${item.source.issue}`, item.source.pages && `pp. ${item.source.pages}`, item.source.doi && `DOI: ${item.source.doi}`]
                  .filter(Boolean).join(" · ")}
              </p>
            )}
            {found && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                {Object.keys(found.suggestions).length === 0 ? (
                  <p className="text-slate-600">
                    {found.ai === "used"
                      ? "The text doesn't clearly state the missing details. Use Edit details to add them."
                      : "Nothing found. AI is off or unavailable, so only a DOI can be read from the text. Use Edit details to add the rest."}
                  </p>
                ) : (
                  <>
                    <p className="font-semibold text-slate-700">Found in the text. Check each one before you apply it.</p>
                    <ul className="mt-2 space-y-1.5">
                      {Object.entries(found.suggestions).map(([field, value]) => (
                        <li key={field}>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              checked={foundPicked.includes(field)}
                              onChange={() =>
                                setFoundPicked((prev) => (prev.includes(field) ? prev.filter((x) => x !== field) : [...prev, field]))
                              }
                              className="mt-0.5 size-4 shrink-0 accent-[#102b5c]"
                            />
                            <span className="min-w-0 break-words text-slate-600">
                              <span className="font-medium text-slate-700">{DETAIL_LABEL[field] ?? field}: </span>
                              {value}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-3 flex gap-2">
                  {Object.keys(found.suggestions).length > 0 && (
                    <button type="button" onClick={applyFound} disabled={applying || foundPicked.length === 0} className="btn-primary !px-3 !py-1.5 !text-xs">
                      {applying ? "Applying…" : "Apply selected"}
                    </button>
                  )}
                  <button type="button" onClick={() => setFound(null)} disabled={applying} className="btn-secondary !px-3 !py-1.5 !text-xs">
                    {Object.keys(found.suggestions).length > 0 ? "Dismiss" : "Close"}
                  </button>
                </div>
              </div>
            )}
            {canEdit && <SourceEditor source={item.source} onSave={(v) => act("/source", "PATCH", v)} />}
            <div className="mt-4">
              <TagInput tags={item.tags} readOnly={!canEdit} onChange={(tags) => run("/tags", "PUT", { tags })} />
            </div>
          </section>

          {item.aiOutput?.summary || item.aiOutput?.paraphrase ? (
          <section className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                  <Sparkles className="size-5" />
                </div>
                <h2 className="whitespace-nowrap font-semibold">AI summary</h2>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  {aiEnabled && (
                    <>
                      <button
                        onClick={() => setAiSettingsOpen(true)}
                        title="AI summary settings for this clip"
                        aria-label="AI summary settings"
                        className="inline-flex items-center justify-center rounded-lg bg-white/10 p-1.5 text-white transition hover:bg-white/20"
                      >
                        <Settings className="size-4" />
                      </button>
                      <button
                        onClick={() => setRegenOpen(true)}
                        disabled={regenerating}
                        title="Rewrite using this clip's AI settings"
                        aria-label={regenerating ? "Regenerating AI summary" : "Regenerate AI summary"}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-1.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 sm:px-3"
                      >
                        <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">{regenerating ? "Regenerating…" : "Regenerate"}</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={editingAiOutput ? () => setEditingAiOutput(false) : editAiOutput}
                    disabled={savingAiOutput}
                    title={editingAiOutput ? "Cancel edits" : "Edit saved AI answer"}
                    aria-label={editingAiOutput ? "Cancel edits" : "Edit AI answer"}
                    className="inline-flex items-center justify-center rounded-lg bg-white/10 p-1.5 text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    {editingAiOutput ? <X className="size-4" /> : <Pencil className="size-4" />}
                  </button>
                </div>
              )}
            </div>
            {editingAiOutput ? (
              <div className="mt-4 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-cyan-200">Summary</span>
                  <textarea
                    value={aiSummaryDraft}
                    onChange={(event) => setAiSummaryDraft(event.target.value)}
                    maxLength={20000}
                    rows={8}
                    aria-label="Edit AI summary"
                    className="w-full rounded-xl border border-white/15 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none focus:ring-4 focus:ring-cyan-300/20"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-cyan-200">Key arguments</span>
                  <textarea
                    value={aiParaphraseDraft}
                    onChange={(event) => setAiParaphraseDraft(event.target.value)}
                    maxLength={20000}
                    rows={5}
                    aria-label="Edit key arguments"
                    className="w-full rounded-xl border border-white/15 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none focus:ring-4 focus:ring-cyan-300/20"
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveAiOutput}
                    disabled={savingAiOutput}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-ink hover:bg-cyan-300 disabled:opacity-60"
                  >
                    <Save className="size-3.5" />
                    {savingAiOutput ? "Saving…" : "Save edits"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {item.aiOutput.summary || "No AI summary for this clip."}
                </p>
                {item.aiOutput.paraphrase && (
                  <>
                    <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                      Key arguments (paraphrased)
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-blue-100/80">{item.aiOutput.paraphrase}</p>
                  </>
                )}
              </>
            )}
            {!aiEnabled && (
              <p className="mt-4 text-xs text-blue-100/60">
                AI generation is unavailable. This saved answer remains available{canEdit ? " and can still be edited" : ""}.
              </p>
            )}
          </section>
          ) : (
            <>
              {(item.aiQuotaExceeded || (aiEnabled && canEdit)) && (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-950">
                    {item.aiQuotaExceeded
                      ? "The daily AI limit was reached while clipping. This Quick Summary is made by Owlet without AI. You can generate an AI summary after the limit resets at midnight UTC."
                      : "No AI summary has been generated for this clip yet."}
                  </p>
                  {canEdit && aiEnabled && (
                    <button
                      type="button"
                      onClick={() => setRegenOpen(true)}
                      disabled={regenerating}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
                    >
                      <Sparkles className="size-3.5" />
                      Generate AI summary
                    </button>
                  )}
                </section>
              )}
              <QuickSummary
                text={item.content?.rawText ?? ""}
                tags={item.tags}
                canEdit={canEdit}
                onAddTag={(t) => run("/tags", "PUT", { tags: [...new Set([...item.tags, t])] })}
              />
            </>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <RelatedClips itemId={id} />
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

          {pdfUrl && (
            <section className="card p-5">
              {/* opens the reader in its own tab, like a document in Google Docs */}
              <Link
                to={`/item/${id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center gap-3 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <Highlighter className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">Original PDF</span>
                  <span className="block text-xs text-slate-500">
                    {canEdit ? "Read and highlight on the page" : "Read on the page"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-slate-300 transition group-hover:text-blue-500" />
              </Link>
            </section>
          )}

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
          onHighlight={saveHighlight}
        />
      </Modal>

      <Modal
        open={readingNotesOpen}
        onClose={() => setReadingNotesOpen(false)}
        title="My reading notes"
        maxWidth="max-w-xl"
        footer={
          canEdit ? (
            <>
              <button type="button" onClick={() => setReadingNotesOpen(false)} disabled={workflowSaving} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await saveWorkflow()) setReadingNotesOpen(false);
                }}
                disabled={workflowSaving}
                className="btn-primary"
              >
                {workflowSaving ? "Saving…" : "Save notes"}
              </button>
            </>
          ) : undefined
        }
      >
        {canEdit ? (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Reading status</span>
              <select
                value={readingStatus}
                onChange={(event) => setReadingStatus(event.target.value as "to_read" | "reading" | "done")}
                className="field"
              >
                <option value="to_read">To read</option>
                <option value="reading">Reading</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Notes</span>
              <textarea
                value={userSummary}
                onChange={(event) => setUserSummary(event.target.value)}
                maxLength={2000}
                rows={8}
                placeholder="Write your own summary or research notes…"
                className="field"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="chip">{readingStatus === "done" ? "Done" : readingStatus === "reading" ? "Reading" : "To read"}</span>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{userSummary || "No personal summary yet."}</p>
          </div>
        )}
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

      {aiEnabled && (
        <AiSettingsModal
          open={aiSettingsOpen}
          onClose={() => setAiSettingsOpen(false)}
          itemId={id}
          settings={aiSettings}
          canEdit={canEdit}
          onSave={saveAiSettings}
          onRegenerate={regenerate}
        />
      )}

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

      {aiEnabled && (
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
          hasSummary={!!item.aiOutput?.summary}
        />
      )}
    </div>
  );
}