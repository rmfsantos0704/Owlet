import { Fragment, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ColorPicker from "../shared/ColorPicker";
import { styleFor } from "../../utils/colors";
import type { Comment, Highlight } from "../../types";

type Props = {
  highlights: Highlight[];
  /** Used only to tell the person how many comments go with a highlight. */
  comments?: Comment[];
  readOnly?: boolean;
  /** Should throw on failure so the editor stays open. */
  onEdit: (highlightId: string, color: string, note: string) => Promise<unknown>;
  onDelete: (highlightId: string) => Promise<unknown> | void;
  /** When given, the quote becomes a button (for highlights tied to a page), e.g. to jump to that page in the PDF reader. */
  onSelect?: (highlight: Highlight) => void;
  /** Shown when there are no highlights. */
  emptyText?: string;
  /** Scrolls this highlight's card into view and flashes it. Pass a new `nonce` each time. */
  focus?: { id: string; nonce: number };
  /** Puts a "Page n" heading above each page's highlights. Pass the highlights sorted by page. */
  groupByPage?: boolean;
};

const clip = (s: string, n = 160) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export default function HighlightList({
  highlights,
  comments = [],
  readOnly,
  onEdit,
  onDelete,
  onSelect,
  emptyText = "No highlights yet. Select text in the clipped text to add one.",
  focus,
  groupByPage,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string>("yellow");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // a highlight was clicked somewhere else (on the PDF page): bring its card into view and flash it
  useEffect(() => {
    if (!focus) return;
    const card = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-highlight-id]") ?? []).find(
      (el) => el.dataset.highlightId === focus.id
    );
    if (!card) return;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(focus.id);
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // replies carry their parent's highlight id, so this counts comments and replies together
  const attachedTo = (id: string) => comments.filter((c) => c.highlightId === id).length;

  function startEdit(h: Highlight) {
    setConfirmId(null);
    setEditingId(h._id);
    setEditColor(h.color || "yellow");
    setEditNote(h.note ?? "");
    setEditError("");
  }

  function cancelEdit() {
    if (saving) return;
    setEditingId(null);
    setEditError("");
  }

  async function saveEdit(id: string) {
    if (saving) return;
    setSaving(true);
    setEditError("");
    try {
      await onEdit(id, editColor, editNote.trim());
      setEditingId(null);
    } catch {
      setEditError("Could not save the highlight. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setDeleting(false);
      setConfirmId(null);
    }
  }

  if (!highlights.length) {
    return <p className="text-sm text-slate-400">{emptyText}</p>;
  }

  return (
    <ul ref={listRef} className="space-y-2">
      {highlights.map((h, index) => {
        const editing = editingId === h._id;
        const confirming = confirmId === h._id;
        const attached = attachedTo(h._id);
        const jumpable = !!onSelect && !!h.page && !editing;
        const startsGroup = !!groupByPage && (index === 0 || highlights[index - 1].page !== h.page);

        const quote = (
          <>
            <span className="block break-words text-sm text-slate-800">“{clip(h.text)}”</span>
            {h.page && !groupByPage && (
              <span className="mt-1 block text-[11px] font-medium text-slate-500">p. {h.page}</span>
            )}
          </>
        );

        return (
          <Fragment key={h._id}>
            {startsGroup && (
              <li className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {h.page ? `Page ${h.page}` : "Not tied to a page"}
              </li>
            )}
            <li
              data-highlight-id={h._id}
              className={`rounded-xl border p-3 transition-shadow ${styleFor(editing ? editColor : h.color).card} ${
                flashId === h._id ? "ring-2 ring-blue-500 ring-offset-1" : ""
              }`}
            >
              {jumpable ? (
                <button
                  type="button"
                  onClick={() => onSelect!(h)}
                  title={`Go to page ${h.page}`}
                  className="block w-full text-left"
                >
                  {quote}
                </button>
              ) : (
                <div>{quote}</div>
              )}

              {editing ? (
                <div className="mt-3 space-y-2.5">
                  <ColorPicker value={editColor} onChange={setEditColor} disabled={saving} />
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    disabled={saving}
                    autoFocus
                    placeholder="Add a note (optional). Leave empty to remove it."
                    aria-label="Highlight note"
                    className="field bg-white"
                  />
                  {editError && (
                    <p role="alert" className="text-xs text-red-600">
                      {editError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={cancelEdit} disabled={saving} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="button" onClick={() => saveEdit(h._id)} disabled={saving} className="btn-primary">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {h.note && <p className="mt-1.5 whitespace-pre-line break-words text-xs text-slate-600">{h.note}</p>}

                  {confirming ? (
                    <div className="mt-3 space-y-2 rounded-lg bg-white/70 p-2.5 text-xs text-slate-700">
                      <p>
                        {attached > 0
                          ? `This also deletes the ${attached} comment${attached === 1 ? "" : "s"} attached to it, including replies. `
                          : ""}
                        This can't be undone.
                      </p>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirmId(null)} disabled={deleting} className="btn-secondary">
                          Cancel
                        </button>
                        <button type="button" onClick={() => confirmDelete(h._id)} disabled={deleting} className="btn-danger">
                          {deleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    !readOnly && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => startEdit(h)}
                          className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-blue-600"
                          aria-label="Edit highlight"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setConfirmId(h._id);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-red-600"
                          aria-label="Delete highlight"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}