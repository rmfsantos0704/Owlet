import { useState } from "react";
import { CornerDownRight, Pencil, Trash2 } from "lucide-react";
import HighlightPicker from "./HighlightPicker";
import { styleFor } from "../utils/colors";
import type { Comment, Highlight } from "../types";

type Props = {
  comments: Comment[];
  highlights: Highlight[];
  readOnly?: boolean;
  /** Should throw on failure so the form keeps what was typed. */
  onAdd: (text: string, highlightId?: string, parentId?: string) => Promise<void> | void;
  /** Should throw on failure so the editor stays open. */
  onEdit: (commentId: string, text: string) => Promise<void> | void;
  onDelete: (commentId: string) => void;
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
// both dates are set when a comment is created, so allow a second of difference
const wasEdited = (c: Comment) => !!c.updatedAt && +new Date(c.updatedAt) - +new Date(c.createdAt) > 1000;

export default function CommentThread({ comments, highlights, readOnly, onAdd, onEdit, onDelete }: Props) {
  const [text, setText] = useState("");
  const [highlightId, setHighlightId] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const [busy, setBusy] = useState(false);

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);
  const highlightOf = (id?: string) => (id ? highlights.find((h) => h._id === id) : undefined);

  async function post() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t, highlightId || undefined);
      setText("");
      setHighlightId("");
    } catch {
      /* the page already shows the error; keep the text so nothing is lost */
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(parentId: string) {
    const t = replyText.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t, undefined, parentId);
      setReplyText("");
      setReplyTo(null);
    } catch {
      /* keep the reply text */
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Comment) {
    setEditingId(c._id);
    setEditText(c.text);
    setEditError("");
    setReplyTo(null);
  }

  function cancelEdit() {
    if (busy) return;
    setEditingId(null);
    setEditError("");
  }

  async function saveEdit(c: Comment) {
    const t = editText.trim();
    if (!t || busy) return;
    if (t === c.text) return setEditingId(null); // nothing changed
    setBusy(true);
    setEditError("");
    try {
      await onEdit(c._id, t);
      setEditingId(null);
    } catch {
      setEditError("Could not save the change. You can only edit your own comments.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(c: Comment, hasReplies: boolean) {
    const msg = hasReplies ? "Delete this comment and its replies?" : "Delete this comment?";
    if (confirm(msg)) onDelete(c._id);
  }

  // the comment's text, or its editor while it is being edited
  function body(c: Comment) {
    if (editingId !== c._id) {
      return <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-800">{c.text}</p>;
    }
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          maxLength={2000}
          rows={3}
          autoFocus
          disabled={busy}
          aria-label="Edit comment"
          className="field bg-white"
        />
        {editError && (
          <p role="alert" className="text-xs text-red-600">
            {editError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cancelEdit} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={() => saveEdit(c)} disabled={busy || !editText.trim()} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  const meta = (c: Comment) => (
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
      <span className="min-w-0 truncate font-medium text-slate-700">{c.authorEmail ?? "Someone"}</span>
      <span className="shrink-0">
        {when(c.createdAt)}
        {wasEdited(c) && " · edited"}
      </span>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Composer: fixed at the top, never scrolls */}
      {!readOnly && (
        <div className="shrink-0 space-y-2 border-b border-slate-100 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add a comment…"
            aria-label="New comment"
            className="field"
          />
          {highlights.length > 0 && (
            <HighlightPicker highlights={highlights} value={highlightId} onChange={setHighlightId} disabled={busy} />
          )}
          <div className="flex justify-end">
            <button type="button" onClick={post} disabled={busy || !text.trim()} className="btn-primary">
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Only this list scrolls */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {topLevel.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}

        {topLevel.map((c) => {
          const replies = repliesOf(c._id);
          const hl = highlightOf(c.highlightId);
          const editing = editingId === c._id;
          return (
            <div key={c._id} className="space-y-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                {meta(c)}
                {hl && (
                  <p className={`mt-2 rounded-r-lg border-l-4 py-1 pl-2 pr-2 text-xs italic text-slate-600 ${styleFor(hl.color).quote}`}>
                    “{clip(hl.text)}”
                  </p>
                )}
                {body(c)}
                {!readOnly && !editing && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(replyTo === c._id ? null : c._id);
                        setReplyText("");
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                    >
                      <CornerDownRight className="size-3.5" /> Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-600"
                      title="Edit (only your own comments)"
                    >
                      <Pencil className="size-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(c, replies.length > 0)}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600"
                      title="Delete (only your own comments)"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>

              {(replies.length > 0 || replyTo === c._id) && (
                <div className="ml-4 space-y-2 border-l-2 border-slate-100 pl-3">
                  {replies.map((r) => (
                    <div key={r._id} className="rounded-xl bg-slate-50 p-3">
                      {meta(r)}
                      {body(r)}
                      {!readOnly && editingId !== r._id && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-blue-600"
                            title="Edit (only your own replies)"
                          >
                            <Pencil className="size-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(r, false)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600"
                            title="Delete (only your own replies)"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {!readOnly && replyTo === c._id && (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        autoFocus
                        placeholder="Write a reply…"
                        aria-label="Reply"
                        className="field"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setReplyTo(null)} className="btn-secondary">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => sendReply(c._id)}
                          disabled={busy || !replyText.trim()}
                          className="btn-primary"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}