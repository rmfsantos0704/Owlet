import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Download, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, download } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import Toast, { type Notice } from "../components/shared/Toast";

// just a small spinning circle with a label, instead of the full owl loading screen
function ColumnsLoader() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2.5 p-12 text-sm font-medium text-slate-500">
      <Loader2 className="size-5 animate-spin text-brand" aria-hidden="true" />
      Loading columns
    </div>
  );
}

type Column = { id: string; name: string };
type ClipRow = { id: string; title: string; values: Record<string, string> };
type MatrixResponse = { columns: Column[]; clips: ClipRow[]; total: number; page: number; pageSize: number };

export default function LiteratureMatrix() {
  // the matrix belongs to the collection in the URL: /Collection/:id/matrix
  const { id: routeId } = useParams();
  const { collections, ready } = useCollections();
  const current = (collections ?? []).find((c) => c.id === routeId);
  const collectionId = current?.id;
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnsDirty, setColumnsDirty] = useState(false);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [newColumn, setNewColumn] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const [savingColumns, setSavingColumns] = useState(false);
  const [savingCell, setSavingCell] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const requestKey = collectionId ? `${collectionId}:${page}` : "";
  const loading = !!requestKey && loadedKey !== requestKey;

  // a different collection starts on its first page
  useEffect(() => {
    setPage(1);
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    let cancelled = false;
    api<MatrixResponse>(`/collections/${collectionId}/matrix?page=${page}`)
      .then((response) => {
        if (cancelled) return;
        setError("");
        setColumns(response.columns);
        setColumnsDirty(false);
        setClips(response.clips);
        setTotal(response.total);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Couldn't load the literature matrix");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => { cancelled = true; };
  }, [collectionId, page, requestKey]);

  if (!ready) return <ColumnsLoader />;
  if (!current) {
    return (
      <p className="text-sm text-slate-500">
        This collection doesn't exist or you don't have access to it.{" "}
        <Link to="/" className="font-semibold text-blue-700 hover:underline">Back to your library</Link>
      </p>
    );
  }
  const activeCollection = current;
  const canEdit = activeCollection.role !== "viewer";
  const pageCount = Math.max(1, Math.ceil(total / 100));

  function addColumn(event: FormEvent) {
    event.preventDefault();
    const name = newColumn.trim();
    if (!name || columns.length >= 12) return;
    if (columns.some((column) => column.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("Column names must be unique.");
      return;
    }
    setError("");
    setColumnsDirty(true);
    setColumns((previous) => [...previous, { id: crypto.randomUUID(), name }]);
    setNewColumn("");
  }

  async function saveColumns() {
    setSavingColumns(true);
    setError("");
    setNotice(null);
    try {
      const response = await api<{ columns: Column[] }>(`/collections/${activeCollection.id}/matrix`, {
        method: "PUT",
        body: { columns },
      });
      setColumns(response.columns);
      setColumnsDirty(false);
      setNotice({ text: "Matrix columns saved.", error: false });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save the matrix columns");
    } finally {
      setSavingColumns(false);
    }
  }

  async function saveCell(clip: ClipRow, columnId: string) {
    const value = clip.values[columnId] ?? "";
    setSavingCell(`${clip.id}:${columnId}`);
    setError("");
    try {
      const response = await api<{ matrixValues: Record<string, string> }>(`/research/${clip.id}/matrix`, {
        method: "PATCH",
        body: { columnId, value },
      });
      setClips((rows) => rows.map((row) => row.id === clip.id ? { ...row, values: response.matrixValues } : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save this matrix cell");
    } finally {
      setSavingCell("");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="btn-secondary mb-4 inline-flex items-center gap-2">
            <ArrowLeft className="size-4" />
            Back to {activeCollection.name}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Literature matrix</h1>
          <p className="mt-1 text-sm text-slate-500">Organize clips from {activeCollection.name} by research question, method, sample, findings, or your own columns.</p>
        </div>
        <button
          type="button"
          onClick={() => download(`/collections/${activeCollection.id}/matrix/export`, "literature-matrix.csv").catch((cause) => setError(cause.message))}
          className="btn-secondary"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </header>

      {canEdit && (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-ink">Matrix columns</h2>
            <p className="mt-1 text-xs text-slate-400">Add or rename up to 12 columns. Removing a column clears its values across this collection.</p>
          </div>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {columns.map((column, index) => (
              <div
                key={column.id}
                className="flex items-center rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1 focus-within:border-brand focus-within:bg-white"
              >
                <input
                  aria-label={`Column ${index + 1} name`}
                  value={column.name}
                  maxLength={50}
                  size={Math.min(Math.max(column.name.length, 6), 24)}
                  onChange={(event) => {
                    const name = event.target.value;
                    setColumnsDirty(true);
                    setColumns((previous) => previous.map((entry) => entry.id === column.id ? { ...entry, name } : entry));
                  }}
                  className="bg-transparent py-1 text-xs font-medium text-slate-700 outline-none"
                />
                <button
                  type="button"
                  title={`Remove ${column.name}`}
                  aria-label={`Remove ${column.name}`}
                  onClick={() => {
                    setColumnsDirty(true);
                    setColumns((previous) => previous.filter((entry) => entry.id !== column.id));
                  }}
                  className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={addColumn} className="flex w-full min-w-0 flex-1 gap-2 sm:w-auto sm:max-w-md">
              <input
                value={newColumn}
                onChange={(event) => setNewColumn(event.target.value)}
                maxLength={50}
                placeholder="New column name"
                className="field min-w-0 flex-1"
                disabled={columns.length >= 12}
              />
              <button
                type="submit"
                disabled={!newColumn.trim() || columns.length >= 12}
                aria-label="Add column"
                title="Add column"
                className="btn-secondary shrink-0 px-3"
              >
                <Plus className="size-4" />
              </button>
            </form>
            <button
              type="button"
              onClick={() => void saveColumns()}
              disabled={savingColumns || !columnsDirty}
              aria-label={savingColumns ? "Saving columns" : "Save columns"}
              title={savingColumns ? "Saving columns" : "Save columns"}
              className="btn-primary shrink-0 px-3"
            >
              <Save className="size-4" />
            </button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <section className="card overflow-hidden">
        {loading ? (
          <ColumnsLoader />
        ) : clips.length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-500">No clips in this collection yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-56 border-b border-slate-200 bg-slate-50 px-4 py-3">Clip</th>
                  {columns.map((column) => <th key={column.id} scope="col" className="min-w-64 border-b border-slate-200 px-3 py-3">{column.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clips.map((clip) => (
                  <tr key={clip.id} className="align-top">
                    <th scope="row" className="sticky left-0 z-10 max-w-72 border-r border-slate-100 bg-white px-4 py-3 font-medium">
                      <Link to={`/item/${clip.id}`} className="line-clamp-3 text-slate-700 hover:text-blue-700">{clip.title}</Link>
                    </th>
                    {columns.map((column) => {
                      const cellKey = `${clip.id}:${column.id}`;
                      return (
                        <td key={column.id} className="p-2">
                          {canEdit ? (
                            <textarea
                              value={clip.values?.[column.id] ?? ""}
                              maxLength={2000}
                              rows={3}
                              disabled={columnsDirty}
                              aria-label={`${column.name} for ${clip.title}`}
                              onChange={(event) => {
                                const value = event.target.value;
                                setClips((rows) => rows.map((row) => row.id === clip.id
                                  ? { ...row, values: { ...row.values, [column.id]: value } }
                                  : row));
                              }}
                              onBlur={() => void saveCell(clip, column.id)}
                              className="field min-w-64 resize-y text-xs"
                            />
                          ) : (
                            <p className="min-h-16 whitespace-pre-wrap px-2 py-1 text-xs text-slate-600">{clip.values?.[column.id]}</p>
                          )}
                          {savingCell === cellKey && <span className="px-2 text-[10px] text-slate-400">Saving…</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {columns.length === 0 && <p className="p-4 text-sm text-slate-500">Add a column to start recording findings for each clip.</p>}
          </div>
        )}
        {total > 100 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>{total} clips · page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-secondary !py-1.5">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="btn-secondary !py-1.5">Next</button>
            </div>
          </div>
        )}
      </section>

      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}