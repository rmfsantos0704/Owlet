import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../services/api";

type Props<T> = {
  clips: T[];
  getId: (clip: T) => string;
  getLabel: (clip: T) => string; // used for the checkbox's accessible name
  renderClip: (clip: T) => ReactNode;
  onDeleted: (ids: string[]) => void; // ids that were actually deleted
  onNotice: (notice: { text: string; error: boolean }) => void;
  title: string;
  subtitle?: ReactNode; // clip count, tag chip, etc.
  actions?: ReactNode; // shown beside "Select" when not selecting (e.g. export buttons)
  canSelect?: boolean;
  loading?: boolean;
  error?: string;
  empty?: ReactNode;
  resetKey?: string; // when this changes, select mode is exited
};

export default function SelectableClips<T>({
  clips,
  getId,
  getLabel,
  renderClip,
  onDeleted,
  onNotice,
  title,
  subtitle,
  actions,
  canSelect = true,
  loading = false,
  error = "",
  empty,
  resetKey,
}: Props<T>) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allSelected = clips.length > 0 && selected.size === clips.length;

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // leave select mode when the list changes underneath the selection (new search, tag, collection)
  useEffect(exitSelect, [resetKey]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0 || deleting) return;
    if (!confirm(`Delete ${ids.length} clip${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;

    setDeleting(true);
    const results = await Promise.allSettled(ids.map((id) => api(`/research/${id}`, { method: "DELETE" })));
    const deleted = ids.filter((_, i) => results[i].status === "fulfilled");
    const failed = ids.length - deleted.length;

    if (deleted.length > 0) onDeleted(deleted);

    if (failed > 0) {
      // keep only the failed ones selected so they can be retried or deselected
      setSelected(new Set(ids.filter((id) => !deleted.includes(id))));
      onNotice({
        text: `${deleted.length} deleted. ${failed} couldn't be deleted. You may not have permission.`,
        error: deleted.length === 0,
      });
    } else {
      exitSelect();
      onNotice({ text: `${deleted.length} clip${deleted.length === 1 ? "" : "s"} deleted.`, error: false });
    }
    setDeleting(false);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">{title}</h2>
          {subtitle && <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">{subtitle}</div>}
        </div>

        {clips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selectMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelected(allSelected ? new Set() : new Set(clips.map(getId)))}
                  disabled={deleting}
                  className="text-sm font-medium text-slate-500 hover:text-brand disabled:opacity-50"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={selected.size === 0 || deleting}
                  className="btn-danger disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Deleting…" : `Delete (${selected.size})`}
                </button>
                <button type="button" onClick={exitSelect} disabled={deleting} className="btn-secondary">
                  Cancel
                </button>
              </>
            ) : (
              <>
                {canSelect && (
                  <button type="button" onClick={() => setSelectMode(true)} className="btn-secondary">
                    Select
                  </button>
                )}
                {actions}
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="px-5 py-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="px-5 py-16 text-center text-sm text-slate-400">Loading…</p>
      ) : clips.length === 0 ? (
        empty
      ) : (
        <div className="divide-y divide-slate-100">
          {clips.map((clip) => {
            const id = getId(clip);
            const isSelected = selected.has(id);
            return (
              <div
                key={id}
                className={`flex items-stretch ${selectMode && isSelected ? "bg-blue-50/60" : ""}`}
                // in select mode, clicking anywhere on the row toggles it instead of opening the clip
                onClickCapture={(e) => {
                  if (!selectMode) return;
                  if ((e.target as HTMLElement).closest("input[type=checkbox]")) return;
                  e.preventDefault();
                  e.stopPropagation();
                  toggle(id);
                }}
              >
                {selectMode && (
                  <label className="flex shrink-0 cursor-pointer items-start pl-5 pt-5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(id)}
                      aria-label={`Select ${getLabel(clip)}`}
                      className="size-4 rounded border-slate-300"
                    />
                  </label>
                )}
                <div className="min-w-0 flex-1">{renderClip(clip)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}