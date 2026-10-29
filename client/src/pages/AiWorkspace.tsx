import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Check, Copy, FileText, Plus, Sparkles, X } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import { useDialog } from "../context/DialogContext";
import Modal from "../components/Modal";
import RecentSessions, { sessionTitle } from "../components/RecentSessions";
import Sources from "../components/Sources";
import type { AiSession, ResearchItem } from "../types";

const MODES = ["Research brief", "Summarize", "Compare sources"] as const;
type Mode = (typeof MODES)[number];
const MAX_SOURCES = 8;
const DEFAULT_SELECTED = 6;
const MAX_TITLE = 100;

type Evidence = { source: number; quote: string; verified: boolean };
type Result = {
  title: string;
  summary: string;
  findings: { title: string; text: string; sources: number[]; evidence?: Evidence[] }[];
  sources: { id: string; title: string }[];
  mode: string;
};

export default function AiWorkspace() {
  const { current, ready } = useCollections();
  const dialog = useDialog();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null); // a session created this visit that hasn't been seen in the list yet
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("Research brief");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [showResult, setShowResult] = useState(false); // the results modal
  const [copied, setCopied] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null); // set when "New session" is clicked; drives the notice

  // Hide the "new session started" notice after a few seconds. Clicking again restarts the timer.
  useEffect(() => {
    if (startedAt === null) return;
    const t = setTimeout(() => setStartedAt(null), 3000);
    return () => clearTimeout(t);
  }, [startedAt]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setResult(null);
    setShowResult(false);
    setActiveId(null);
    setNewId(null);
    setTitle("");
    setPrompt("");
    setError("");
    setSessions([]);

    const qs = current ? `?collectionId=${current.id}` : "";
    api<{ items: ResearchItem[] }>(`/research${qs}`)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setSelected(r.items.slice(0, DEFAULT_SELECTED).map((i) => i._id));
      })
      .catch(() => !cancelled && setItems([]));

    if (current) {
      api<{ sessions: AiSession[] }>(`/research/sessions?collectionId=${current.id}`)
        .then((r) => !cancelled && setSessions(r.sessions))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [ready, current?.id]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SOURCES ? s : [...s, id]));
  }

  function newSession() {
    setActiveId(null);
    setNewId(null);
    setResult(null);
    setShowResult(false);
    setTitle("");
    setPrompt("");
    setError("");
    setMode("Research brief");
    setSelected(items.slice(0, DEFAULT_SELECTED).map((i) => i._id));
    setStartedAt(Date.now());
  }

  function openSession(s: AiSession) {
    const existing = new Set(items.map((i) => i._id));
    setActiveId(s.id);
    setMode(s.mode);
    setTitle(s.title ?? "");
    setPrompt(s.prompt);
    setSelected(s.sources.map((x) => x.id).filter((id) => existing.has(id)));
    setResult({ title: s.title ?? "", summary: s.summary, findings: s.findings, sources: s.sources, mode: s.mode });
    setError("");
    setShowResult(true);
  }

  async function renameSession(s: AiSession) {
    const next = await dialog.prompt({
      title: "Rename session",
      label: "Session title",
      defaultValue: sessionTitle(s),
      maxLength: MAX_TITLE,
      confirmLabel: "Save",
    });
    if (next === null) return;
    try {
      const r = await api<{ session: AiSession }>(`/research/sessions/${s.id}`, {
        method: "PATCH",
        body: { title: next.trim() },
      });
      setSessions((list) => list.map((x) => (x.id === s.id ? r.session : x)));
      if (activeId === s.id) {
        setTitle(r.session.title ?? "");
        setResult((res) => (res ? { ...res, title: r.session.title ?? "" } : res));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename the session");
    }
  }

  async function deleteSession(s: AiSession) {
    const ok = await dialog.confirm({ title: "Delete this session?", message: "The saved result is removed. Your sources are not affected.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/research/sessions/${s.id}`, { method: "DELETE" });
      setSessions((list) => list.filter((x) => x.id !== s.id));
      if (newId === s.id) setNewId(null);
      if (activeId === s.id) {
        setActiveId(null);
        setResult(null);
        setShowResult(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the session");
    }
  }

  async function run() {
    setError("");
    setRunning(true);
    try {
      const r = await api<Omit<Result, "mode" | "title"> & { session: AiSession | null }>("/research/ask", {
        method: "POST",
        // sessionId present = re-run: update that session in place instead of creating a new one
        body: { itemIds: selected, mode, prompt, title: title.trim(), sessionId: activeId ?? undefined },
      });
      const saved = r.session;
      setResult({
        title: saved?.title ?? title.trim(),
        summary: r.summary,
        findings: r.findings,
        sources: r.sources,
        mode,
      });
      setShowResult(true); // open the results as soon as they are ready
      if (saved) {
        const isNew = !sessions.some((x) => x.id === saved.id);
        setSessions((list) =>
          list.some((x) => x.id === saved.id)
            ? list.map((x) => (x.id === saved.id ? saved : x))
            : [saved, ...list].slice(0, 20)
        );
        setActiveId(saved.id);
        // Only a freshly created session gets the "new" indicator, not an in-place re-run
        if (isNew) setNewId(saved.id);
      } else {
        setActiveId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  async function copy() {
    if (!result) return;
    const text = [
      result.summary,
      ...result.findings.map(
        (f, i) =>
          `\n${i + 1}. ${f.title}\n${f.text}\nSources: ${f.sources.map((n) => result.sources[n - 1]?.title).filter(Boolean).join("; ")}` +
          (f.evidence ?? []).map((e) => `\n> "${e.quote}" (${result.sources[e.source - 1]?.title ?? "source"})`).join("")
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const itemIds = new Set(items.map((i) => i._id));
  const removedSources = result ? result.sources.filter((s) => !itemIds.has(s.id)).length : 0;
  const justCreated = !!result && !!activeId && activeId === newId;

  return (
    <div>
      <Link
        to="/"
        className="mb-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-brand"
      >
        <ArrowLeft className="size-3.5 shrink-0" />
        <span className="truncate">Back to {current?.name ?? "collection"}</span>
      </Link>

      <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2 text-violet-600">
            <Sparkles className="size-3.5" />
            AI workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Build from your research</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Ask questions across your saved sources and turn evidence into citation-ready briefs.
          </p>
        </div>
        <button
          onClick={newSession}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Plus className="size-4" />
          New session
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-brand p-5 text-white shadow-xl shadow-blue-950/10 sm:p-6">
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    mode === m ? "bg-white text-brand" : "bg-white/10 text-blue-100 hover:bg-white/15"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                <Bot className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">{mode}</h2>
                <p className="mt-1 text-xs leading-5 text-blue-100/70">
                  Owlet will use the {selected.length} selected source{selected.length === 1 ? "" : "s"}
                  {current ? ` in ${current.name}` : ""}.
                </p>
              </div>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="Session title (optional)"
              aria-label="Session title"
              className="mt-5 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-blue-100/45 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
              placeholder="What patterns do these sources reveal? (optional)"
              className="mt-3 min-h-28 w-full resize-none rounded-xl border border-white/10 bg-white/10 p-4 text-sm leading-6 text-white outline-none placeholder:text-blue-100/45 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            />
            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-[11px] text-blue-100/60">
                <Check className="size-3.5 text-emerald-300" />
                {activeId ? "Re-running updates this session" : "Every run is saved to Recent sessions"}
              </div>
              <button
                onClick={run}
                disabled={running || selected.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-ink hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                {running ? "Analyzing…" : activeId ? "Re-run analysis" : "Run analysis"}
              </button>
            </div>
            {error && <p className="mt-3 text-xs font-medium text-red-300">{error}</p>}
          </div>
        </div>

        <div className="space-y-6 xl:self-start">
          <Sources items={items} selected={selected} max={MAX_SOURCES} onToggle={toggle} />

          <RecentSessions
            sessions={sessions}
            activeId={activeId}
            newId={newId}
            onSeen={() => setNewId(null)}
            onOpen={openSession}
            onRename={renameSession}
            onDelete={deleteSession}
          />

          {/* Compact result card: the full brief opens in a modal so the page doesn't grow */}
          {result && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-ink">{result.title || result.mode}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {result.title ? `${result.mode} · ` : ""}Based on {result.sources.length} sources
                    {removedSources > 0 ? ` · ${removedSources} no longer in this collection` : ""}
                  </p>
                  {justCreated && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Check className="size-3" />
                      New session saved
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowResult(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]"
              >
                <FileText className="size-4" />
                View results
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Small popup pinned to the bottom-right corner when "New session" is clicked; closes itself after a few seconds */}
      {startedAt !== null && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex w-72 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Check className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">New session started</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">Pick your sources and run an analysis.</p>
          </div>
          <button
            type="button"
            onClick={() => setStartedAt(null)}
            aria-label="Dismiss"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {result && (
        <Modal
          open={showResult}
          onClose={() => setShowResult(false)}
          title={result.title || result.mode}
          maxWidth="max-w-3xl"
          footer={
            <>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => setShowResult(false)}
                className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]"
              >
                Close
              </button>
            </>
          }
        >
          <div>
            <p className="mb-4 text-xs text-slate-400">
              {result.title ? `${result.mode} · ` : ""}Based on {result.sources.length} sources
              {removedSources > 0 ? ` · ${removedSources} no longer in this collection` : ""}
            </p>
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="eyebrow mb-2 text-blue-600">Executive summary</div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.summary}</p>
            </div>
            <div className="space-y-5">
              {result.findings.map((f, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{f.text}</p>
                    <p className="mt-2 text-xs font-semibold text-blue-700">
                      {f.sources.map((n) => result.sources[n - 1]?.title).filter(Boolean).join(" · ")}
                    </p>
                    {(f.evidence ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(f.evidence ?? []).map((e, k) => {
                          const src = result.sources[e.source - 1];
                          return (
                            <blockquote key={k} className="rounded-lg border-l-2 border-violet-300 bg-slate-50 px-3 py-2">
                              <p className="text-xs italic leading-5 text-slate-600">“{e.quote}”</p>
                              <p className="mt-1 text-[10px] text-slate-400">
                                {src && itemIds.has(src.id) ? (
                                  <Link
                                    to={`/item/${src.id}`}
                                    onClick={() => setShowResult(false)}
                                    className="font-semibold text-blue-700 hover:underline"
                                  >
                                    {src.title}
                                  </Link>
                                ) : (
                                  <span>{src?.title ?? "Source"}</span>
                                )}{" "}
                                · {e.verified ? "exact quote" : "passage excerpt"}
                              </p>
                            </blockquote>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}