import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquareText, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCollectionScope } from "../hooks/useCollectionScope";
import { useDialog } from "../context/DialogContext";
import FilterBar, { type FilterSelect } from "../components/FilterBar";
import type { ResearchItem } from "../types";

const FILTERS = ["All", "On highlights", "General"] as const;
const TINTS = ["bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700"];

function tint(email = "") {
  let n = 0;
  for (const ch of email) n += ch.charCodeAt(0);
  return TINTS[n % TINTS.length];
}

export default function Comments() {
  const { user } = useAuth();
  const dialog = useDialog();
  const { ready, scope, setScope, scopeCollection, qs, options: collectionOptions } = useCollectionScope();
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").toLowerCase();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  // search + filters
  const [search, setSearch] = useState("");
  const [clipId, setClipId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api<{ items: ResearchItem[] }>(`/research${qs}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load comments"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ready, qs]);

  // the clip and user filters only make sense inside the collection they were picked in
  useEffect(() => {
    setClipId("");
    setUserEmail("");
  }, [scope]);

  const threads = useMemo(
    () =>
      items
        .flatMap((item) =>
          (item.comments ?? []).map((c) => ({
            ...c,
            item,
            highlight: c.highlightId ? item.highlights?.find((h) => h._id === c.highlightId) : undefined,
          }))
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [items]
  );

  const clipOptions = useMemo(() => {
    const m = new Map<string, string>();
    threads.forEach((t) => m.set(t.item._id, t.item.source?.title ?? "Untitled"));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [threads]);

  const authors = useMemo(
    () => [...new Set(threads.map((t) => t.authorEmail).filter((e): e is string => !!e))].sort(),
    [threads]
  );

  const needle = search.trim().toLowerCase();
  const matches = (c: (typeof threads)[number], s: string) =>
    !s ||
    c.text.toLowerCase().includes(s) ||
    (c.authorEmail ?? "").toLowerCase().includes(s) ||
    (c.item.source?.title ?? "").toLowerCase().includes(s) ||
    (c.highlight?.text ?? "").toLowerCase().includes(s);

  const shown = threads.filter(
    (c) =>
      (filter === "All" || (filter === "On highlights" ? !!c.highlightId : !c.highlightId)) &&
      (!clipId || c.item._id === clipId) &&
      (!userEmail || c.authorEmail === userEmail) &&
      matches(c, q) &&
      matches(c, needle)
  );

  const filtersActive = !!(needle || clipId || userEmail);

  function clearFilters() {
    setSearch("");
    setClipId("");
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
    {
      id: "user",
      label: "User",
      value: userEmail,
      onChange: setUserEmail,
      options: [{ value: "", label: "All users" }, ...authors.map((a) => ({ value: a, label: a }))],
    },
  ];

  async function remove(itemId: string, commentId: string) {
    const ok = await dialog.confirm({ title: "Delete this comment?", message: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      const r = await api<{ comments: ResearchItem["comments"] }>(`/research/${itemId}/comments/${commentId}`, { method: "DELETE" });
      setItems((list) => list.map((i) => (i._id === itemId ? { ...i, comments: r.comments } : i)));
    } catch (e) {
      void dialog.alert({ title: "Couldn't delete the comment", message: e instanceof Error ? e.message : "Please try again." });
    }
  }

  const people = useMemo(() => {
    const m = new Map<string, number>();
    threads.forEach((t) => t.authorEmail && m.set(t.authorEmail, (m.get(t.authorEmail) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [threads]);

  return (
    <div>
      <section className="mb-8">
        <div className="eyebrow mb-2 text-blue-600">Team collaboration</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Comments</h1>
        <p className="mt-2 text-sm text-slate-500">
          Questions, feedback, and decisions across {scopeCollection ? scopeCollection.name : "all your collections"}.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="space-y-4 border-b border-slate-100 p-4">
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold ${
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
              placeholder="Search comments, people, or sources"
              selects={selects}
              active={filtersActive}
              onClear={clearFilters}
              shown={shown.length}
              total={threads.length}
              noun="comments"
            />
          </div>

          {loading ? (
            <p className="px-5 py-16 text-center text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="px-5 py-16 text-center text-sm text-red-600">{error}</p>
          ) : shown.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <MessageSquareText className="mx-auto mb-3 size-6 text-slate-300" />
              <div className="text-sm font-medium text-slate-600">
                {filtersActive || q ? "No comments match your search" : "No comments yet"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {filtersActive || q ? "Try a different search or clear the filters." : "Open a clip to start a discussion."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map((c) => {
                const mine = c.authorEmail && c.authorEmail === user?.email;
                return (
                  <article key={`${c.item._id}-${c._id}`} className="p-5 sm:p-6">
                    <div className="flex gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${tint(c.authorEmail)}`}>
                        {(c.authorEmail ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-semibold text-slate-800">{c.authorEmail ?? "Unknown"}</span>
                          <span className="text-[11px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                          {mine && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">You</span>}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{c.text}</p>

                        <Link
                          to={`/item/${c.item._id}`}
                          className="mt-4 flex items-stretch gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                        >
                          <span className="w-1 shrink-0 rounded-full bg-amber-400" />
                          <span className="min-w-0">
                            {c.highlight && (
                              <span className="line-clamp-2 block text-xs italic text-slate-600">“{c.highlight.text}”</span>
                            )}
                            <span className="mt-1 block truncate text-[10px] font-medium text-slate-400">
                              {c.item.source?.title ?? "Untitled"}
                            </span>
                          </span>
                        </Link>

                        {mine && (
                          <button
                            onClick={() => remove(c.item._id, c._id)}
                            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink">Active collaborators</h2>
          {people.length === 0 ? (
            <p className="text-xs text-slate-400">People who comment appear here.</p>
          ) : (
            <div className="space-y-4">
              {people.map(([email, n]) => (
                <div key={email} className="flex items-center gap-3">
                  <div className={`flex size-8 items-center justify-center rounded-lg text-[10px] font-bold ${tint(email)}`}>
                    {email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-700">{email}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{n} comment{n === 1 ? "" : "s"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}