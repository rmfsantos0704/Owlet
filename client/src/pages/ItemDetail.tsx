import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, FileDown, Sparkles, Trash2 } from "lucide-react";
import { api, download } from "../services/api";
import CitationBox from "../components/CitationBox";
import TagInput from "../components/TagInput";
import HighlightList from "../components/HighlightList";
import ClippedText from "../components/ClippedText";
import CommentThread from "../components/CommentThread";
import type { ResearchItem, Role } from "../types";

export default function ItemDetail() {
  const [role, setRole] = useState<Role | null>(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
api<{ item: ResearchItem; role: Role | null }>(`/research/${id}`)
  .then((r) => { setItem(r.item); setRole(r.role); })
  .catch((e) => setError(e.message));
  }, [id]);

  async function act(path: string, method: string, body?: unknown) {
    try {
      const changed = await api<Partial<ResearchItem>>(`/research/${id}${path}`, { method, body });
      setItem((prev) => (prev ? { ...prev, ...changed } : prev));
      setActionError("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function remove() {
    if (!confirm("Delete this clip?")) return;
    await api(`/research/${id}`, { method: "DELETE" });
    navigate("/");
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
  if (!item) return <p className="text-slate-400">Loading…</p>;
const _canEdit = role === "owner" || role === "editor";

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand">
        <ChevronLeft className="size-4" /> Back to library
      </Link>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <a
              href={item.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 hover:underline"
            >
              {item.source.domain}
            </a>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{item.source.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {[item.source.author, item.source.publishedDate].filter(Boolean).join(" · ") || "No author information"}
            </p>
            <div className="mt-4">
              <TagInput tags={item.tags} onChange={(tags) => act("/tags", "PUT", { tags })} />
            </div>
          </section>

          <section className="rounded-2xl bg-brand p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                <Sparkles className="size-5" />
              </div>
              <h2 className="font-semibold">AI summary</h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/90">
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
              Clipped text ({item.content?.wordCount ?? 0} words)
            </summary>
            <div className="mt-4">
              <ClippedText
                text={item.content?.rawText ?? ""}
                onHighlight={(text, color, note) => act("/highlights", "POST", { text, color, note })}
              />
            </div>
          </details>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-ink">Comments</h2>
            <CommentThread
              comments={item.comments}
              highlights={item.highlights}
              onAdd={(text, highlightId) => act("/comments", "POST", { text, highlightId })}
              onDelete={(cid) => act(`/comments/${cid}`, "DELETE")}
            />
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold text-ink">Citations</h2>
            <CitationBox label="APA" text={item.citations.apa ?? ""} />
            <CitationBox label="MLA" text={item.citations.mla ?? ""} />
            <CitationBox label="Chicago" text={item.citations.chicago ?? ""} />
            <p className="text-[11px] text-slate-400">Auto-generated from page metadata. Verify before submitting.</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-ink">Highlights</h2>
            <HighlightList highlights={item.highlights} onDelete={(hid) => act(`/highlights/${hid}`, "DELETE")} />
          </section>

          <div className="flex gap-2">
            <button onClick={downloadPdf} className="btn-secondary flex-1">
              <FileDown className="size-4" /> Download PDF
            </button>
            <button onClick={remove} className="btn-danger" title="Delete clip">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}