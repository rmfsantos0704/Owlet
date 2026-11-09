import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, Highlighter, Loader2, MessageSquareText, Search, Sparkles, Table, type LucideIcon } from "lucide-react";
import { api, ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCollectionScope } from "../hooks/useCollectionScope";
import { styleFor } from "../utils/colors";
import type { SearchResponse, SearchResult } from "../types";

const KINDS: Record<SearchResult["kind"], { label: string; plural: string; icon: LucideIcon; tone: string }> = {
  clip: { label: "Source", plural: "Sources", icon: FileText, tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  highlight: { label: "Highlight", plural: "Highlights", icon: Highlighter, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  comment: { label: "Comment", plural: "Comments", icon: MessageSquareText, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  matrix: { label: "Matrix entry", plural: "Matrix entries", icon: Table, tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
};

const MATCH: Record<SearchResult["match"], { label: string; tone: string }> = {
  strong: { label: "Strong match", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  good: { label: "Good match", tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  related: { label: "Related", tone: "bg-slate-100 text-slate-600" },
};

const EXAMPLES = [
  "Sources discussing the risks of AI dependency",
  "Evidence that challenges the main argument",
  "How the studies measured the outcome",
];

type Filter = "all" | SearchResult["kind"];

// Search by meaning: describe an idea and Owlet finds the clips, highlights, comments and matrix entries about it,
// even when they use different words.
export default function ConceptSearch() {
  const { aiOffByUser } = useAuth();
  const { ready, scope, setScope, options } = useCollectionScope();
  const [params, setParams] = useSearchParams();
  const query = params.get("concept") ?? "";
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [indexing, setIndexing] = useState<number | null>(null); // clips still being prepared, while that runs
  const [filter, setFilter] = useState<Filter>("all");
  const run = useRef(0); // each search gets a number, so a late answer to an old search is ignored

  const scopeParam = scope === "all" ? "" : `&collectionId=${scope}`;

  useEffect(() => {
    setInput(query);
  }, [query]);

  async function search(text: string, quiet = false) {
    const id = ++run.current;
    if (!quiet) {
      setSearching(true);
      setError("");
      setFilter("all");
    }
    try {
      const r = await api<SearchResponse>(`/search?q=${encodeURIComponent(text)}${scopeParam}`);
      if (run.current !== id) return;
      setResults(r.results);
      if (r.pending > 0) void catchUp(id, text, r.pending);
      else setIndexing(null);
    } catch (e) {
      if (run.current !== id) return;
      if (e instanceof ApiError && e.status === 503) setUnavailable(true);
      else setError(e instanceof Error ? e.message : "Search failed");
      setIndexing(null);
    } finally {
      if (run.current === id) setSearching(false);
    }
  }

  // New or changed clips are prepared in small steps; when they are all done, the search runs once more.
  async function catchUp(id: number, text: string, pending: number) {
    let left = pending;
    setIndexing(left);
    while (left > 0 && run.current === id) {
      try {
        const r = await api<{ indexed: number; pending: number }>("/search/index", {
          method: "POST",
          body: { collectionId: scope === "all" ? undefined : scope },
        });
        if (run.current !== id) return;
        if (r.indexed === 0) break; // no progress: stop instead of asking forever
        left = r.pending;
        setIndexing(left);
      } catch {
        break;
      }
    }
    if (run.current === id) {
      setIndexing(null);
      void search(text, true);
    }
  }

  // run whenever the question or the collection changes
  useEffect(() => {
    if (!ready) return;
    if (query.trim().length < 3) {
      run.current++;
      setResults(null);
      setIndexing(null);
      setSearching(false);
      return;
    }
    void search(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, query, scope]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (text.length < 3) return;
    if (text === query) void search(text);
    else setParams({ concept: text });
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, clip: 0, highlight: 0, comment: 0, matrix: 0 };
    for (const r of results ?? []) {
      c.all++;
      c[r.kind]++;
    }
    return c;
  }, [results]);
  const shown = (results ?? []).filter((r) => filter === "all" || r.kind === filter);

  if (aiOffByUser) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Concept search</h1>
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          You turned AI features off, and concept search is one of them.{" "}
          <Link to="/account" className="font-semibold text-blue-700 underline">Turn AI back on in your account</Link> to use it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-2 text-blue-600">Search by meaning</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Concept search</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Describe an idea in your own words. Owlet finds sources, highlights, comments and matrix entries about it, even when they use different words.
        </p>
      </header>

      <form onSubmit={submit} className="card space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={300}
              placeholder="e.g. Sources discussing the risks of AI dependency"
              aria-label="Describe what you're looking for"
              className="field pl-10"
            />
          </div>
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Where to search" className="field sm:w-52">
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="submit" disabled={searching || input.trim().length < 3} className="btn-primary">
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Search
          </button>
        </div>
        {!query && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setParams({ concept: example })}
                className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 hover:bg-slate-200"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </form>

      {indexing !== null && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Loader2 className="size-4 animate-spin" />
          Getting your library ready for searching ({indexing} source{indexing === 1 ? "" : "s"} left). Results will update when it's done.
        </p>
      )}

      {unavailable ? (
        <p role="alert" className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          Concept search isn't set up on this server yet.
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : results === null ? null : (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-4">
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {(["all", "clip", "highlight", "comment", "matrix"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {f === "all" ? "All" : KINDS[f].plural} <span className="text-slate-400">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Search className="mx-auto mb-3 size-6 text-slate-300" />
              <div className="text-sm font-medium text-slate-600">{results.length === 0 ? "Nothing matched that idea" : "No results of this type"}</div>
              <div className="mt-1 text-xs text-slate-400">
                {results.length === 0 ? "Try describing it differently, or search in all collections." : "Try another tab."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map((r) => {
                const kind = KINDS[r.kind];
                const Icon = kind.icon;
                return (
                  <article key={r.id} className="flex items-start gap-3 p-5 transition hover:bg-slate-50/70">
                    <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/item/${r.itemId}`} className="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-blue-700">
                          {r.title}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${MATCH[r.match].tone}`}>{MATCH[r.match].label}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">
                        {kind.label}
                        {r.page ? ` · p. ${r.page}` : ""}
                        {r.author ? ` · ${r.author}` : ""}
                        {r.origin ? ` · ${r.origin}` : ""}
                        {r.collectionName ? ` · ${r.collectionName}` : ""}
                      </div>
                      {r.kind === "highlight" ? (
                        <div className={`mt-2 rounded-r-lg border-l-4 p-2.5 ${styleFor(r.color).bar}`}>
                          <p className="break-words text-xs leading-5 text-slate-700">“{r.snippet}”</p>
                        </div>
                      ) : (
                        <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-xs leading-5 text-slate-600">{r.snippet}</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}