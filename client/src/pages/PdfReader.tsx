import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Copy, Download, Highlighter, PanelRight, PanelRightClose, X } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { ResearchItem, Role } from "../types";
import type { BoardQuestion, BoardStance, NewPdfHighlight } from "../components/pdfreader/PdfViewer";
import HighlightList from "../components/itemdetail/HighlightList";
import HighlightFilters from "../components/pdfreader/HighlightFilters";
import HighlightPopover from "../components/pdfreader/HighlightPopover";
import LoadingScreen from "../components/shared/LoadingScreen";
import { downloadMarkdown, highlightsToMarkdown } from "../utils/exportHighlights";

// loaded only on this page, so the PDF library stays out of the main bundle
const PdfViewer = lazy(() => import("../components/pdfreader/PdfViewer"));

const PANEL_HIDDEN_KEY = "owlet:pdfReaderPanelHidden";
// where the evidence board routes are mounted on the server (see app.ts)
const BOARD_API = "/board";
const ICON_BUTTON =
  "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40";

// The reader: the original PDF on its own full-screen page, with the clip's highlights beside it.
export default function PdfReader() {
  const { id } = useParams();
  const { aiEnabled } = useAuth();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false); // the highlight list on small screens
  const [jump, setJump] = useState<{ page: number; nonce: number } | undefined>();

  // the highlight list on large screens, where it is open by default; the choice is remembered
  const [panelHidden, setPanelHidden] = useState(() => {
    try {
      return localStorage.getItem(PANEL_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  // the highlight emphasised on the page, the popover that edits it, and the list card to flash
  const [activeId, setActiveId] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [listFocus, setListFocus] = useState<{ id: string; nonce: number } | undefined>();

  // panel filters
  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [groupByPage, setGroupByPage] = useState(true);

  const [exportNote, setExportNote] = useState("");
  const [questions, setQuestions] = useState<BoardQuestion[] | undefined>(); // the collection's research questions

  function togglePanelHidden() {
    setPanelHidden((hidden) => {
      try {
        localStorage.setItem(PANEL_HIDDEN_KEY, hidden ? "0" : "1");
      } catch {
        // storage can be unavailable (private mode); the panel still toggles for this visit
      }
      return !hidden;
    });
  }

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

  const collectionId = (item as (ResearchItem & { collectionId?: string }) | null)?.collectionId;
  const editable = role === "owner" || role === "editor";

  // The collection's research questions, for "Add to question". Without a board, the button simply isn't offered.
  useEffect(() => {
    if (!collectionId || !editable) return;
    let cancelled = false;
    api<{ questions: BoardQuestion[] }>(`${BOARD_API}/${collectionId}`)
      .then((r) => !cancelled && setQuestions(r.questions))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [collectionId, editable]);

  // the popover closes if its highlight is deleted (here or by someone else)
  useEffect(() => {
    if (popover && item && !item.highlights.some((h) => h._id === popover.id)) {
      setPopover(null);
      setActiveId(null);
    }
  }, [item, popover]);

  // the emphasis on the page fades after a moment, unless the popover is open
  useEffect(() => {
    if (!activeId || popover) return;
    const t = setTimeout(() => setActiveId(null), 2200);
    return () => clearTimeout(t);
  }, [activeId, popover]);

  // same pattern as the clip page: merge the changed fields back in, and throw so callers can react
  async function act(path: string, method: string, body?: unknown): Promise<Partial<ResearchItem>> {
    try {
      const changed = await api<Partial<ResearchItem>>(`/research/${id}${path}`, { method, body });
      setItem((prev) => (prev ? { ...prev, ...changed } : prev));
      setActionError("");
      return changed;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  }

  const createHighlight = (h: NewPdfHighlight) => act("/highlights", "POST", h);

  // Edit throws on failure so the editor stays open.
  const editHighlight = (hid: string, color: string, note: string) =>
    act(`/highlights/${hid}`, "PATCH", { color, note });

  // The list asks for confirmation itself, and the error is already shown in the banner, so don't rethrow.
  // Resolves to whether the highlight was deleted.
  const removeHighlight = (hid: string) =>
    act(`/highlights/${hid}`, "DELETE").then(
      () => true,
      () => false
    );

  const addComment = (text: string, highlightId: string) => act("/comments", "POST", { text, highlightId });

  // Saves the selection as a highlight, then files it on the evidence board under a research question.
  // Throws only if the highlight itself couldn't be saved; resolves to whether it also reached the board.
  async function createForQuestion(h: NewPdfHighlight, target: { questionId: string | null; stance: BoardStance }) {
    const changed = await act("/highlights", "POST", h);
    const created = changed.highlights?.[changed.highlights.length - 1]; // new highlights are added at the end
    if (!created || !collectionId) return false;
    try {
      await api(`${BOARD_API}/${collectionId}/links`, {
        method: "POST",
        body: {
          links: [{ kind: "highlight", stance: target.stance, questionId: target.questionId, itemId: id, highlightId: created._id }],
        },
      });
      return true;
    } catch (e) {
      setActionError(
        `The highlight was saved, but it couldn't be added to the board: ${e instanceof Error ? e.message : "unknown error"}`
      );
      return false;
    }
  }

  // Explain / Summarize the selected text. Only offered while AI is available to this person.
  const askAi = aiEnabled
    ? async (text: string, mode: "explain" | "summarize") => {
        const r = await api<{ answer: string }>(`/research/${id}/explain`, { method: "POST", body: { text, mode } });
        return r.answer;
      }
    : undefined;

  const sorted = useMemo(
    () =>
      [...(item?.highlights ?? [])].sort(
        (a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || +new Date(a.createdAt) - +new Date(b.createdAt)
      ),
    [item?.highlights]
  );

  const colors = useMemo(() => [...new Set(sorted.map((h) => h.color).filter(Boolean))], [sorted]);

  const filtering = query.trim() !== "" || colorFilter !== null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter(
      (h) =>
        (!colorFilter || h.color === colorFilter) &&
        (!q || h.text.toLowerCase().includes(q) || (h.note ?? "").toLowerCase().includes(q))
    );
  }, [sorted, query, colorFilter]);

  function clearFilters() {
    setQuery("");
    setColorFilter(null);
  }

  // A highlight was clicked on the page: open its popover, and show its card in the list.
  function onPageHighlightClick(hid: string, at: { x: number; y: number }) {
    if (filtering && !visible.some((h) => h._id === hid)) clearFilters(); // so its card is there to be found
    setActiveId(hid);
    setPopover({ id: hid, x: at.x, y: at.y });
    setListFocus({ id: hid, nonce: Date.now() });
  }

  function closePopover() {
    setPopover(null);
    setActiveId(null);
  }

  function say(note: string) {
    setExportNote(note);
    setTimeout(() => setExportNote(""), 2500);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">Back to Owlet</Link>
      </div>
    );
  }
  if (!item || !id) return <LoadingScreen label="Opening your clip…" />;

  const canEdit = editable;
  const pdfUrl = item.source.kind === "pdf" ? item.source.fileUrl : undefined;
  const clipPath = `/item/${id}`;
  const popoverHighlight = popover ? item.highlights.find((h) => h._id === popover.id) : undefined;

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(highlightsToMarkdown(item!));
      say("Copied as Markdown");
    } catch {
      say("Couldn't copy. Try Download instead.");
    }
  }

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
        <button
          type="button"
          onClick={togglePanelHidden}
          aria-expanded={!panelHidden}
          aria-controls="highlights-panel"
          title={panelHidden ? "Show highlights" : "Hide highlights"}
          className="btn-secondary hidden lg:inline-flex"
        >
          {panelHidden ? <PanelRight className="size-4" /> : <PanelRightClose className="size-4" />}
          <span>{panelHidden ? `Show highlights (${item.highlights.length})` : "Hide highlights"}</span>
        </button>
      </header>

      {actionError && <p role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-700">{actionError}</p>}

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <Suspense fallback={<LoadingScreen label="Loading the PDF…" fill="parent" />}>
            <PdfViewer
              url={pdfUrl}
              rawText={item.content?.rawText ?? ""}
              pageOffsets={item.content?.pageOffsets ?? []}
              highlights={item.highlights}
              canEdit={canEdit}
              onCreate={createHighlight}
              jumpTo={jump}
              storageKey={id}
              activeId={activeId}
              onHighlightClick={onPageHighlightClick}
              onAsk={askAi}
              questions={questions}
              onCreateForQuestion={createForQuestion}
            />
          </Suspense>
        </main>

        <aside
          id="highlights-panel"
          aria-label="Highlights"
          className={`${panelOpen ? "flex" : "hidden"} absolute inset-y-0 right-0 z-20 w-80 max-w-[85vw] shrink-0 flex-col border-l border-slate-200 bg-white shadow-xl lg:static lg:shadow-none ${panelHidden ? "lg:hidden" : "lg:flex"}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Highlighter className="size-4 text-amber-600" /> Highlights ({item.highlights.length})
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={copyMarkdown}
                disabled={!item.highlights.length}
                title="Copy highlights as Markdown"
                aria-label="Copy highlights as Markdown"
                className={ICON_BUTTON}
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => downloadMarkdown(item.source.title, highlightsToMarkdown(item))}
                disabled={!item.highlights.length}
                title="Download highlights as Markdown"
                aria-label="Download highlights as Markdown"
                className={ICON_BUTTON}
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close highlights"
                className={`${ICON_BUTTON} lg:hidden`}
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                onClick={togglePanelHidden}
                aria-label="Hide highlights"
                title="Hide highlights"
                className={`${ICON_BUTTON} hidden lg:inline-flex`}
              >
                <PanelRightClose className="size-4" />
              </button>
            </div>
          </div>

          {exportNote && (
            <p role="status" className="shrink-0 px-4 pt-2 text-[11px] text-slate-500">{exportNote}</p>
          )}

          {(item.highlights.length > 3 || filtering) && (
            <HighlightFilters
              colors={colors}
              query={query}
              onQuery={setQuery}
              color={colorFilter}
              onColor={setColorFilter}
              groupByPage={groupByPage}
              onGroupByPage={setGroupByPage}
              shown={visible.length}
              total={item.highlights.length}
              onClear={clearFilters}
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <HighlightList
              highlights={visible}
              comments={item.comments}
              readOnly={!canEdit}
              onEdit={editHighlight}
              onDelete={removeHighlight}
              onSelect={(h) => {
                if (!h.page) return;
                setJump({ page: h.page, nonce: Date.now() });
                setActiveId(h._id); // flashes it on the page
                setPopover(null);
                setPanelOpen(false);
              }}
              focus={listFocus}
              groupByPage={groupByPage}
              emptyText={
                filtering
                  ? "No highlights match your filters."
                  : canEdit
                    ? "Select text on a page to add your first highlight."
                    : "No highlights yet."
              }
            />
          </div>
        </aside>
      </div>

      {popover && popoverHighlight && (
        <HighlightPopover
          highlight={popoverHighlight}
          comments={item.comments}
          canEdit={canEdit}
          anchor={{ x: popover.x, y: popover.y }}
          onEdit={editHighlight}
          onDelete={async (hid) => {
            if (await removeHighlight(hid)) closePopover();
          }}
          onAddComment={addComment}
          onClose={closePopover}
        />
      )}
    </div>
  );
}