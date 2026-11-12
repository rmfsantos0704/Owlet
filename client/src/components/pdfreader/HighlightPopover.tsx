import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import HighlightList from "../itemdetail/HighlightList";
import type { Comment, Highlight } from "../../types";

type Props = {
  highlight: Highlight;
  comments: Comment[];
  canEdit: boolean;
  /** Where the highlight was clicked, in screen coordinates. */
  anchor: { x: number; y: number };
  /** Should throw on failure so the editor stays open. */
  onEdit: (highlightId: string, color: string, note: string) => Promise<unknown>;
  onDelete: (highlightId: string) => Promise<unknown> | void;
  /** Should throw on failure so what was typed is kept. */
  onAddComment: (text: string, highlightId: string) => Promise<unknown>;
  onClose: () => void;
};

const WIDTH = 320;
const MARGIN = 8;

// the fields the comment type is known to carry on the server, read without depending on the client type
type CommentExtras = Comment & { authorEmail?: string; parentId?: string | null };

// A small card that opens next to a highlight clicked on the PDF page: the quote, color, note, delete and comments.
export default function HighlightPopover({
  highlight, comments, canEdit, anchor, onEdit, onDelete, onAddComment, onClose,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: MARGIN, top: MARGIN, maxHeight: 480 });
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const mine = comments.filter((c) => c.highlightId === highlight._id) as CommentExtras[];

  // placed under the click, or above it when there isn't room, and always kept on screen
  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(anchor.x - WIDTH / 2, vw - WIDTH - MARGIN));
    const height = box.current?.offsetHeight ?? 320;
    let top = anchor.y + 14;
    if (top + height > vh - MARGIN) top = Math.max(MARGIN, anchor.y - height - 14);
    setPos({ left, top, maxHeight: vh - top - MARGIN });
  }, [anchor.x, anchor.y, highlight._id]);

  // Escape or a click anywhere outside closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  async function post() {
    const value = text.trim();
    if (!value || posting) return;
    setPosting(true);
    setError("");
    try {
      await onAddComment(value, highlight._id);
      setText("");
    } catch {
      setError("Could not post the comment. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Highlight"
      className="fixed z-50 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl"
      style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight, width: `min(${WIDTH}px, calc(100vw - ${MARGIN * 2}px))` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Highlight{highlight.page ? ` · page ${highlight.page}` : ""}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>

      <HighlightList
        highlights={[highlight]}
        comments={comments}
        readOnly={!canEdit}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <div className="mt-3 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-600">Comments ({mine.length})</h4>
        {mine.length > 0 && (
          <ul className="mt-2 space-y-2">
            {mine.map((c) => (
              <li key={c._id} className={`rounded-lg bg-slate-50 px-3 py-2 ${c.parentId ? "ml-4" : ""}`}>
                <p className="text-[11px] font-medium text-slate-500">{c.authorEmail ?? "Someone"}</p>
                <p className="mt-0.5 whitespace-pre-line break-words text-xs text-slate-700">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="mt-2 space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={2}
              disabled={posting}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="field"
            />
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={post} disabled={posting || !text.trim()} className="btn-primary !px-3 !py-1.5 !text-xs">
                {posting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}