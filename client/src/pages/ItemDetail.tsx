import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, FileDown, RefreshCw, Settings, Sparkles, Trash2 } from "lucide-react";
import { api, download } from "../services/api";
import CitationBox from "../components/CitationBox";
import TagInput from "../components/TagInput";
import HighlightList from "../components/HighlightList";
import ClippedText from "../components/ClippedText";
import CommentThread from "../components/CommentThread";
import SourceEditor from "../components/SourceEditor";
import AiSettingsModal from "../components/AiSettingsModal";
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

  async function regenerateClicked() {
    if (!confirm("Replace the summary and key arguments using this clip's AI settings?")) return;
    await regenerate();
  }

  // throws on failure so the modal can show the error
  const saveAiSettings = (aiSettings: AiSettings) => act("/ai-settings", "PUT", { aiSettings });

  async function remove() {
    if (!confirm("Delete this clip?")) return;
    try {
      await api(`/research/${id}`, { method: "DELETE" });
      navigate(-1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete");
    }
  }

  async function downloadPdf() {
    const name = (item?.source.title ?? "owlet-brief").replace(/[^\w]+/g, "-").slice(0, 60);
    try {
      await download(`/research/${id}/pdf`, `${name}.pdf`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Download failed");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!item || !id) return <p className="text-slate-400">Loading…</p>;

  const canEdit = role === "owner" || role === "editor";
  const isPdf = item.source.kind === "pdf";

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand">
        <ChevronLeft className="size-4" /> Back
      </button>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6">
            {item.source.url ? (
              <a
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
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
                    onClick={regenerateClicked}
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

          <details className="card p-5">
            <summary className="cursor-pointer font-semibold text-ink">
              {isPdf ? "Extracted text" : "Clipped text"} ({item.content?.wordCount ?? 0} words)
            </summary>
            <div className="mt-4">
              <ClippedText
                text={item.content?.rawText ?? ""}
                readOnly={!canEdit}
                onHighlight={(text, color, note) => act("/highlights", "POST", { text, color, note })}
              />
            </div>
          </details>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-ink">Comments</h2>
            <CommentThread
              comments={item.comments}
              highlights={item.highlights}
              readOnly={!canEdit}
              onAdd={(text, highlightId) => act("/comments", "POST", { text, highlightId })}
              onDelete={(cid) => run(`/comments/${cid}`, "DELETE")}
            />
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
            <h2 className="mb-3 font-semibold text-ink">Highlights</h2>
            <HighlightList
              highlights={item.highlights}
              readOnly={!canEdit}
              onDelete={(hid) => run(`/highlights/${hid}`, "DELETE")}
            />
          </section>

          <div className="flex gap-2">
            <button onClick={downloadPdf} className="btn-secondary flex-1">
              <FileDown className="size-4" /> Download PDF
            </button>
            {canEdit && (
              <button onClick={remove} className="btn-danger" title="Delete clip">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <AiSettingsModal
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        itemId={id}
        settings={item.aiSettings}
        canEdit={canEdit}
        onSave={saveAiSettings}
        onRegenerate={regenerate}
      />
    </div>
  );
}