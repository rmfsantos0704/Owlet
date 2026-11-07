import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Highlighter, PanelRight, Trash2, X } from "lucide-react";
import { api } from "../services/api";
import { useDialog } from "../context/DialogContext";
import { styleFor } from "../utils/colors";
import type { ResearchItem, Role } from "../types";
import type { NewPdfHighlight } from "../components/pdfreader/PdfViewer";

// loaded only on this page, so the PDF library stays out of the main bundle
const PdfViewer = lazy(() => import("../components/pdfreader/PdfViewer"));

const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

// The reader: the original PDF on its own full-screen page, with the clip's highlights beside it.
export default function PdfReader() {
  const { id } = useParams();
  const dialog = useDialog();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false); // the highlight list on small screens
  const [jump, setJump] = useState<{ page: number; nonce: number } | undefined>();

  useEffect(() => {
    let cancelled = false;
    api<{ item: ResearchItem; role: Role | null }>(`/research/${id}`)
      .then((r) => {
        if (cancelled) return;
        setItem(r.item);
        setRole(r.role);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't open this clip"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // same pattern as the clip page: merge the changed fields back in, and throw so callers can react
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

  const createHighlight = (h: NewPdfHighlight) => act("/highlights", "POST", h);

  async function removeHighlight(highlightId: string) {
    const ok = await dialog.confirm({
      title: "Delete this highlight?",
      message: "Comments attached to it are deleted too. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await act(`/highlights/${highlightId}`, "DELETE").catch(() => {});
  }

  const sorted = useMemo(
    () =>
      [...(item?.highlights ?? [])].sort(
        (a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || +new Date(a.createdAt) - +new Date(b.createdAt)
      ),
    [item?.highlights]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">Back to Owlet</Link>
      </div>
    );
  }
  if (!item || !id) return <p className="p-10 text-center text-slate-400">Loading…</p>;

  const canEdit = role === "owner" || role === "editor";
  const pdfUrl = item.source.kind === "pdf" ? item.source.fileUrl : undefined;
  const clipPath = `/item/${id}`;

  if (!pdfUrl) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-10 text-center">
        <h1 className="text-lg font-semibold text-ink">No original PDF for this clip</h1>
        <p className="text-sm text-slate-500">
          Only PDFs imported after the viewer was added keep their original file. You can still read and highlight the
          extracted text.
        </p>
        <Link to={clipPath} className="btn-secondary inline-flex">Back to the clip</Link>
      </div>
    );
  }

  return (
    // pinned to the viewport, so no navbar or max-width container from the app shell can constrain it
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100 text-slate-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
        <Link
          to={clipPath}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-brand"
        >
          <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Back to clip</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{item.source.title ?? "Untitled PDF"}</h1>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className="btn-secondary lg:hidden"
        >
          <PanelRight className="size-4" /> {item.highlights.length}
        </button>
      </header>

      {actionError && <p role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-700">{actionError}</p>}

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">Loading the PDF…</p>}>
            <PdfViewer
              url={pdfUrl}
              rawText={item.content?.rawText ?? ""}
              pageOffsets={item.content?.pageOffsets ?? []}
              highlights={item.highlights}
              canEdit={canEdit}
              onCreate={createHighlight}
              jumpTo={jump}
            />
          </Suspense>
        </main>

        <aside
          aria-label="Highlights"
          className={`${panelOpen ? "flex" : "hidden"} absolute inset-y-0 right-0 z-20 w-80 max-w-[85vw] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl lg:static lg:flex lg:shadow-none`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Highlighter className="size-4 text-amber-600" /> Highlights ({item.highlights.length})
            </h2>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Close highlights"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {sorted.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-slate-400">
                {canEdit ? "Select text on a page to add your first highlight." : "No highlights yet."}
              </p>
            )}
            {sorted.map((h) => (
              <div key={h._id} className={`rounded-xl border p-3 ${styleFor(h.color).card}`}>
                <button
                  type="button"
                  disabled={!h.page}
                  onClick={() => {
                    if (!h.page) return;
                    setJump({ page: h.page, nonce: Date.now() });
                    setPanelOpen(false);
                  }}
                  className="block w-full text-left disabled:cursor-default"
                  title={h.page ? `Go to page ${h.page}` : undefined}
                >
                  <span className="block break-words text-xs leading-5 text-slate-800">“{clip(h.text)}”</span>
                  <span className="mt-1 block text-[11px] font-medium text-slate-500">
                    {h.page ? `p. ${h.page}` : "Not tied to a page"}
                  </span>
                </button>
                {h.note && <p className="mt-1.5 whitespace-pre-line break-words text-xs text-slate-600">{h.note}</p>}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeHighlight(h._id)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600"
                    aria-label="Delete highlight"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                )}
              </div>
            ))}
            {canEdit && sorted.length > 0 && (
              <p className="px-1 pt-1 text-[11px] text-slate-400">To change a highlight's color or note, use the clip page.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}