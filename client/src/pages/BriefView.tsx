import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, ChevronLeft, Copy, FileDown, Pencil, Trash2 } from "lucide-react";
import { api, download } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import { briefToMarkdown, downloadText } from "../utils/briefMarkdown";
import { templateLabel } from "../components/briefs/Templates";
import LoadingScreen from "../components/shared/LoadingScreen";
import type { Brief, BriefBlock, BriefCitation } from "../types";

const KIND_LABEL: Record<BriefCitation["kind"], string> = {
  text: "From the text",
  highlight: "Your highlight",
  matrix: "Your literature matrix",
};

// A brief, with the evidence behind every claim one click away.
// Lives at /Collection/:id/briefs/:briefId.
export default function BriefView() {
  const { id: collectionRouteId, briefId } = useParams();
  const briefsPath = `/Collection/${collectionRouteId}/briefs`;
  const navigate = useNavigate();
  const dialog = useDialog();
  const { collections } = useCollections();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [titleDraft, setTitleDraft] = useState<string | null>(null); // non-null while the title is being edited
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ brief: Brief }>(`/briefs/${briefId}`)
      .then((r) => !cancelled && setBrief(r.brief))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open this brief"));
    return () => {
      cancelled = true;
    };
  }, [briefId]);

  async function patch(body: object) {
    if (busy) return false;
    setBusy(true);
    setActionError("");
    try {
      const r = await api<{ brief: Brief }>(`/briefs/${briefId}`, { method: "PATCH", body });
      setBrief(r.brief);
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    const title = (titleDraft ?? "").trim();
    if (!title || title === brief?.title) return setTitleDraft(null);
    if (await patch({ title })) setTitleDraft(null);
  }

  async function saveBlock(block: BriefBlock) {
    const text = draft.trim();
    if (!text) return;
    if (text === block.text) return setEditingBlock(null);
    if (await patch({ blocks: { [block.id]: text } })) setEditingBlock(null);
  }

  async function removeBlock(block: BriefBlock) {
    const ok = await dialog.confirm({
      title: "Remove this paragraph?",
      message: "It is removed from the brief. Your sources are not affected.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) await patch({ removeBlocks: [block.id] });
  }

  async function removeBrief() {
    const ok = await dialog.confirm({
      title: `Delete “${brief?.title}”?`,
      message: "This can't be undone. Your sources and highlights are not affected.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/briefs/${briefId}`, { method: "DELETE" });
      navigate(briefsPath);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't delete the brief");
    }
  }

  async function copyMarkdown() {
    if (!brief) return;
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(briefToMarkdown(brief));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Couldn't copy. Use Download instead.");
    }
  }

  async function downloadPdf() {
    if (!brief || pdfBusy) return;
    setMenuOpen(false);
    setPdfBusy(true);
    setActionError("");
    try {
      await download(`/briefs/${brief.id}/pdf`, `${brief.title.replace(/[^\w]+/g, "-").slice(0, 60)}.pdf`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-600">{error}</p>
        <Link to={briefsPath} className="btn-secondary inline-flex">Back to briefs</Link>
      </div>
    );
  }
  if (!brief) return <LoadingScreen label="Opening your brief…" fill="page" />;

  const role = collections?.find((c) => c.id === brief.collectionId)?.role;
  const canEdit = !!role && role !== "viewer";
  const isOutline = brief.generator === "outline";

  const supportNote = (block: BriefBlock) => {
    if (block.citations.length === 0) return "No source is cited for this paragraph. Check it before using it.";
    if (!block.citations.some((c) => c.verified)) return "None of its quotes could be found word for word in the sources. Check it before using it.";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={briefsPath} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand">
          <ChevronLeft className="size-4" /> Briefs
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => void patch({ status: brief.status === "ready" ? "draft" : "ready" })}
              disabled={busy}
              className="btn-secondary"
            >
              <Check className="size-4" /> {brief.status === "ready" ? "Back to draft" : "Mark as ready"}
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} className="btn-secondary">
              {copied ? <Check className="size-4 text-emerald-600" /> : <FileDown className="size-4" />}
              {pdfBusy ? "Preparing…" : copied ? "Copied" : "Export"} <ChevronDown className="size-3.5" />
            </button>
            {menuOpen && (
              <>
                <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <button type="button" onClick={copyMarkdown} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <Copy className="size-4 text-slate-400" /> Copy as Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      downloadText(briefToMarkdown(brief), `${brief.title.replace(/[^\w]+/g, "-").slice(0, 60)}.md`);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <FileDown className="size-4 text-slate-400" /> Download Markdown
                  </button>
                  <button type="button" onClick={downloadPdf} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <FileDown className="size-4 text-slate-400" /> Download PDF
                  </button>
                </div>
              </>
            )}
          </div>
          {canEdit && (
            <button type="button" onClick={removeBrief} className="btn-danger" title="Delete brief">
              <Trash2 className="size-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="eyebrow text-blue-600">{templateLabel(brief.template)}</span>
              {isOutline && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">Outline</span>}
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${brief.status === "ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                {brief.status === "ready" ? "Ready" : "Draft"}
              </span>
              <span className="text-slate-400">{brief.wordCount.toLocaleString()} words</span>
            </div>
            {titleDraft === null ? (
              <div className="mt-2 flex items-start gap-2">
                <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-ink">{brief.title}</h1>
                {canEdit && (
                  <button type="button" onClick={() => setTitleDraft(brief.title)} aria-label="Edit the title" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700">
                    <Pencil className="size-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveTitle();
                    if (e.key === "Escape") setTitleDraft(null);
                  }}
                  maxLength={120}
                  aria-label="Brief title"
                  className="field"
                />
                <button type="button" onClick={saveTitle} disabled={busy} className="btn-primary">Save</button>
                <button type="button" onClick={() => setTitleDraft(null)} disabled={busy} className="btn-secondary">Cancel</button>
              </div>
            )}
            {brief.question && (
              <p className="mt-3 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">Research question: </span>
                {brief.question}
              </p>
            )}
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              {isOutline
                ? "An outline built without AI from your highlights, notes, literature matrix and evidence board. Quotes are copied exactly from your sources. Write your own text in the empty paragraphs to connect them."
                : "Written by AI from your sources. A green “Verified” quote was found word for word in the source. Check every claim against its evidence before you rely on it."}
            </p>
          </section>

          {brief.sections.map((section) => (
            <section key={section.id} className="card space-y-5 p-5 sm:p-6">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{section.title}</h2>
              {section.blocks.map((block) => {
                // outline paragraphs with no citation are just the "nothing to quote" placeholder, not an unsupported claim
                const note = isOutline && block.citations.length === 0 ? "" : supportNote(block);
                const sourcesCited = [...new Set(block.citations.map((c) => c.source))].sort((a, b) => a - b);
                const editing = editingBlock === block.id;
                return (
                  <div key={block.id} className="space-y-2">
                    {editing ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          maxLength={4000}
                          rows={5}
                          aria-label="Edit paragraph"
                          className="field"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingBlock(null)} disabled={busy} className="btn-secondary">Cancel</button>
                          <button type="button" onClick={() => saveBlock(block)} disabled={busy || !draft.trim()} className="btn-primary">
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : block.text ? (
                      <p
                        className={`whitespace-pre-wrap break-words text-sm leading-7 ${
                          isOutline && block.citations.length > 0 ? "border-l-2 border-slate-200 pl-3 text-slate-600" : "text-slate-700"
                        }`}
                      >
                        {block.text}
                        {sourcesCited.map((n) => (
                          <sup key={n} className="ml-0.5 font-semibold text-blue-700">[{n}]</sup>
                        ))}
                      </p>
                    ) : (
                      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm italic text-slate-400">
                        Write your connecting text here.
                      </p>
                    )}

                    {note && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {note}
                      </p>
                    )}

                    {block.citations.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-600">
                          Evidence ({block.citations.length}){block.edited ? " · edited" : ""}
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {block.citations.map((c, i) => (
                            <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                              <p className="break-words italic leading-5 text-slate-600">“{c.quote}”</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                {c.itemId ? (
                                  <Link to={`/item/${c.itemId}`} className="font-medium text-blue-700 hover:underline">
                                    [{c.source}] {brief.sources[c.source - 1]?.title ?? "Source"}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-slate-600">[{c.source}]</span>
                                )}
                                <span className="text-slate-400">{KIND_LABEL[c.kind]}</span>
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${c.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                  {c.verified ? "Verified" : "Not found word for word"}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {canEdit && !editing && (
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBlock(block.id);
                            setDraft(block.text);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-slate-400 hover:text-blue-600"
                        >
                          <Pencil className="size-3.5" /> {block.text ? "Edit" : "Write"}
                        </button>
                        <button type="button" onClick={() => removeBlock(block)} className="inline-flex items-center gap-1 font-medium text-slate-400 hover:text-red-600">
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="min-w-0">
          <section className="card space-y-3 p-5 xl:sticky xl:top-20">
            <h2 className="font-semibold text-ink">Sources</h2>
            <ol className="space-y-3">
              {brief.sources.map((source, i) => (
                <li key={source.itemId + i} className="text-xs leading-5 text-slate-600">
                  <span className="font-semibold text-blue-700">[{i + 1}]</span>{" "}
                  <Link to={`/item/${source.itemId}`} className="hover:text-blue-700 hover:underline">
                    {source.reference || source.title}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}