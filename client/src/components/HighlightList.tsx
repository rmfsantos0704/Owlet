import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { styleFor } from "../utils/colors";
import type { Comment, Highlight } from "../types";

type Props = {
  highlights: Highlight[];
  /** Used only to tell the person how many comments go with a highlight. */
  comments?: Comment[];
  readOnly?: boolean;
  /** Should throw on failure so the editor stays open. */
  onEdit: (highlightId: string, color: string, note: string) => Promise<unknown>;
  onDelete: (highlightId: string) => Promise<unknown> | void;
};

const clip = (s: string, n = 160) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export default function HighlightList({ highlights, comments = [], readOnly, onEdit, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string>("yellow");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    return <p className="text-sm text-slate-400">No highlights yet. Select text in the clipped text to add one.</p>;
  }

  return (
    <ul className="space-y-2">
      {highlights.map((h) => {
        const editing = editingId === h._id;
        const confirming = confirmId === h._id;
        const attached = attachedTo(h._id);
        return (
          <li key={h._id} className={`rounded-xl border p-3 ${styleFor(editing ? editColor : h.color).card}`}>
            <p className="break-words text-sm text-slate-800">“{clip(h.text)}”</p>

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
        );
      })}
    </ul>
  );
}