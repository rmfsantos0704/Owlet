import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Highlighter, MessageSquareText, FileText, Pencil } from "lucide-react";
import { api } from "../services/api";
import { useCollectionScope } from "../hooks/useCollectionScope";
import ColorPicker from "../components/ColorPicker";
import FilterBar, { type FilterSelect } from "../components/FilterBar";
import HighlightsAnalysis, { MAX_ANALYSIS_SOURCES } from "../components/HighlightsAnalysis";
import { styleFor } from "../utils/colors";
import type { Highlight, ResearchItem } from "../types";

const FILTERS = ["All highlights", "With notes"] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// one highlight can be told apart across clips by its clip id plus its own id
const keyOf = (h: { _id: string; item: { _id: string } }) => `${h.item._id}:${h._id}`;

export default function Highlights() {
  const { ready, scope, setScope, scopeCollection, qs, options: collectionOptions } = useCollectionScope();
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").toLowerCase();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All highlights");

  // search + filters
  const [search, setSearch] = useState("");
  const [clipId, setClipId] = useState("");
  const [color, setColor] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // editing one highlight at a time
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string>("yellow");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // highlights picked for "Connect the patterns"
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectionNote, setSelectionNote] = useState("");

  // the list is limited to the chosen collection, so its role decides who sees Edit (the server checks too)
  const canEdit = scopeCollection ? scopeCollection.role !== "viewer" : true;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api<{ items: ResearchItem[] }>(`/research${qs}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load highlights"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, qs]);

  // the clip and user filters only make sense inside the collection they were picked in
  useEffect(() => {
    setClipId("");
    setUserEmail("");
    setEditingId(null);
    setSelectedKeys(new Set());
    setSelectionNote("");
  }, [scope]);

  const all = useMemo(
    () =>
      items
        .flatMap((item) =>
          (item.highlights ?? []).map((h) => ({
            ...h,
            item,
            colorKey: h.color || "yellow",
            // only present if the API records who made the highlight
            author: (h as Highlight & { authorEmail?: string }).authorEmail ?? "",
            commentCount: (item.comments ?? []).filter((c) => c.highlightId === h._id).length,
          }))
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [items]
  );

  const clipOptions = useMemo(() => {
    const m = new Map<string, string>();
    all.forEach((h) => m.set(h.item._id, h.item.source?.title ?? "Untitled"));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const colorCounts = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((h) => m.set(h.colorKey, (m.get(h.colorKey) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const authors = useMemo(() => [...new Set(all.map((h) => h.author).filter(Boolean))].sort(), [all]);

  const needle = search.trim().toLowerCase();
  const matches = (h: (typeof all)[number], s: string) =>
    !s ||
    h.text.toLowerCase().includes(s) ||
    (h.note ?? "").toLowerCase().includes(s) ||
    (h.item.source?.title ?? "").toLowerCase().includes(s) ||
    (h.item.source?.domain ?? "").toLowerCase().includes(s);

  const shown = all.filter(
    (h) =>
      (filter === "All highlights" || !!h.note) &&
      (!clipId || h.item._id === clipId) &&
      (!color || h.colorKey === color) &&
      (!userEmail || h.author === userEmail) &&
      matches(h, q) &&
      matches(h, needle)
  );

  const filtersActive = !!(needle || clipId || color || userEmail);

  function clearFilters() {
    setSearch("");
    setClipId("");
    setColor("");
    setUserEmail("");
  }

  const selects: FilterSelect[] = [
    { id: "collection", label: "Collection", value: scope, onChange: setScope, options: collectionOptions },
    {
      id: "clip",
      label: "Clip",
      value: clipId,
      onChange: setClipId,
      options: [{ value: "", label: "All clips" }, ...clipOptions.map(([id, title]) => ({ value: id, label: title }))],
    },
  ];
  if (authors.length > 0) {
    selects.push({
      id: "user",
      label: "User",
      value: userEmail,
      onChange: setUserEmail,
      options: [{ value: "", label: "All users" }, ...authors.map((a) => ({ value: a, label: a }))],
    });
  }

  // The selection comes from `all`, so it survives changing the search or filters.
  const selected = all.filter((h) => selectedKeys.has(keyOf(h)));
  const selectedSources = new Set(selected.map((h) => h.item._id));

  function toggleSelect(h: (typeof all)[number]) {
    const k = keyOf(h);
    const next = new Set(selectedKeys);
    if (next.has(k)) {
      next.delete(k);
    } else if (!selectedSources.has(h.item._id) && selectedSources.size >= MAX_ANALYSIS_SOURCES) {
      setSelectionNote(`Highlights from up to ${MAX_ANALYSIS_SOURCES} sources can be analyzed at a time.`);
      return;
    } else {
      next.add(k);
    }
    setSelectionNote("");
    setSelectedKeys(next);
  }

  function selectAllShown() {
    const next = new Set(selectedKeys);
    const sources = new Set(selectedSources);
    let skipped = 0;
    for (const h of shown) {
      if (next.has(keyOf(h))) continue;
      if (!sources.has(h.item._id) && sources.size >= MAX_ANALYSIS_SOURCES) {
        skipped++;
        continue;
      }
      sources.add(h.item._id);
      next.add(keyOf(h));
    }
    setSelectedKeys(next);
    setSelectionNote(
      skipped > 0
        ? `${skipped} highlight${skipped === 1 ? "" : "s"} skipped: only ${MAX_ANALYSIS_SOURCES} sources can be analyzed at a time.`
        : ""
    );
  }

  function clearSelection() {
    setSelectedKeys(new Set());
    setSelectionNote("");
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = [
    ["This week", all.filter((h) => +new Date(h.createdAt) > weekAgo).length],
    ["With notes", all.filter((h) => h.note).length],
    ["Total", all.length],
  ];

  function startEdit(h: Highlight) {
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

  async function saveEdit(itemId: string, highlightId: string) {
    if (saving) return;
    setSaving(true);
    setEditError("");
    try {
      const r = await api<{ highlights: Highlight[] }>(`/research/${itemId}/highlights/${highlightId}`, {
        method: "PATCH",
        body: { color: editColor, note: editNote.trim() },
      });
      setItems((prev) => prev.map((i) => (i._id === itemId ? { ...i, highlights: r.highlights } : i)));
      setEditingId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Could not save the highlight");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <section className="mb-8">
        <div className="eyebrow mb-2 text-amber-600">Knowledge library</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Highlights</h1>
        <p className="mt-2 text-sm text-slate-500">
          {all.length} passages collected from {new Set(all.map((h) => h.item._id)).size} sources
          {scopeCollection ? ` in ${scopeCollection.name}` : " across all collections"}.
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-ink">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="space-y-4 border-b border-slate-100 p-4">
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    filter === f ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <FilterBar
              search={search}
              onSearch={setSearch}
              placeholder="Search highlights, notes, or sources"
              selects={selects}
              active={filtersActive}
              onClear={clearFilters}
              shown={shown.length}
              total={all.length}
              noun="highlights"
            >
              {colorCounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-semibold text-slate-400">Color</span>
                  {colorCounts.map(([c, n]) => {
                    const on = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(on ? "" : c)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          on
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {/* a 12px slice of the color's border, so the swatch matches the highlight bars */}
                        <span
                          className={`inline-block h-3 rounded-sm ${styleFor(c).bar}`}
                          style={{ width: 0, borderLeftWidth: 12, borderLeftStyle: "solid" }}
                        />
                        {cap(c)}
                        <span className="text-slate-400">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </FilterBar>
          </div>

          {loading ? (
            <p className="px-5 py-16 text-center text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="px-5 py-16 text-center text-sm text-red-600">{error}</p>
          ) : shown.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Highlighter className="mx-auto mb-3 size-6 text-slate-300" />
              <div className="text-sm font-medium text-slate-600">
                {filtersActive || q ? "No highlights match your search" : "No highlights yet"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {filtersActive || q ? "Try a different search or clear the filters." : "Open a clip and select text to highlight it."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map((h) => {
                const editing = editingId === h._id;
                return (
                  <article
                    key={`${h.item._id}-${h._id}`}
                    className={`p-5 transition sm:p-6 ${selectedKeys.has(keyOf(h)) ? "bg-blue-50/40" : ""}`}
                  >
                    <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(keyOf(h))}
                      onChange={() => toggleSelect(h)}
                      aria-label="Select highlight for analysis"
                      className="mt-1 size-4 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                    <div className={`rounded-r-xl border-l-4 p-4 ${styleFor(editing ? editColor : h.color).bar}`}>
                      <p className="text-sm font-medium leading-6 text-slate-700">“{h.text}”</p>
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link to={`/item/${h.item._id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-700">
                          {h.item.source?.title ?? "Untitled"}
                        </Link>
                        <div className="mt-1 text-xs text-slate-400">
                          {h.item.source?.domain ?? h.item.source?.fileName ?? "Source"} · Highlighted{" "}
                          {new Date(h.createdAt).toLocaleDateString()}
                          {h.author ? ` · ${h.author}` : ""}
                        </div>
                        {h.item.tags?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {h.item.tags.map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canEdit && !editing && (
                          <button
                            type="button"
                            onClick={() => startEdit(h)}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                            aria-label="Edit highlight"
                          >
                            <Pencil className="size-3.5" /> Edit
                          </button>
                        )}
                        <Link
                          to={`/item/${h.item._id}`}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                        >
                          <MessageSquareText className="size-3.5" />
                          {h.commentCount}
                        </Link>
                      </div>
                    </div>

                    {editing ? (
                      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                          className="field"
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
                          <button
                            type="button"
                            onClick={() => saveEdit(h.item._id, h._id)}
                            disabled={saving}
                            className="btn-primary"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      h.note && (
                        <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 whitespace-pre-line break-words">
                            <span className="font-semibold text-slate-700">Your note:</span> {h.note}
                          </span>
                        </div>
                      )
                    )}
                    </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 xl:self-start">
          <HighlightsAnalysis
            selected={selected.map((h) => ({ id: h._id, itemId: h.item._id }))}
            shownCount={shown.length}
            notice={selectionNote}
            resetKey={scope}
            onSelectAll={selectAllShown}
            onClear={clearSelection}
          />
        </div>
      </section>
    </div>
  );
}