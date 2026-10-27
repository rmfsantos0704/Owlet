import { useEffect, useState } from "react";
import { Bot, Check, Copy, Sparkles } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import type { ResearchItem } from "../types";

const MODES = ["Research brief", "Summarize", "Compare sources"] as const;
const MAX_SOURCES = 8;

type Result = {
  summary: string;
  findings: { title: string; text: string; sources: number[] }[];
  sources: { id: string; title: string }[];
  mode: string;
};

export default function AiWorkspace() {
  const { current, ready } = useCollections();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<(typeof MODES)[number]>("Research brief");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setResult(null);
    const qs = current ? `?collectionId=${current.id}` : "";
    api<{ items: ResearchItem[] }>(`/research${qs}`)
      .then((r) => {
        setItems(r.items);
        setSelected(r.items.slice(0, 6).map((i) => i._id));
      })
      .catch(() => setItems([]));
  }, [ready, current?.id]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SOURCES ? s : [...s, id]));
  }

  async function run() {
    setError("");
    setRunning(true);
    try {
      const r = await api<Omit<Result, "mode">>("/research/ask", {
        method: "POST",
        body: { itemIds: selected, mode, prompt },
      });
      setResult({ ...r, mode });
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
        (f, i) => `\n${i + 1}. ${f.title}\n${f.text}\nSources: ${f.sources.map((n) => result.sources[n - 1]?.title).filter(Boolean).join("; ")}`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <section className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2 text-violet-600">
          <Sparkles className="size-3.5" />
          AI workspace
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Build from your research</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Ask questions across your saved sources and turn evidence into citation-ready briefs.
        </p>
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
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
              placeholder="What patterns do these sources reveal? (optional)"
              className="mt-5 min-h-28 w-full resize-none rounded-xl border border-white/10 bg-white/10 p-4 text-sm leading-6 text-white outline-none placeholder:text-blue-100/45 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
            />
            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-[11px] text-blue-100/60">
                <Check className="size-3.5 text-emerald-300" />
                Answers cite the sources you select
              </div>
              <button
                onClick={run}
                disabled={running || selected.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-ink hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                {running ? "Analyzing…" : "Run analysis"}
              </button>
            </div>
            {error && <p className="mt-3 text-xs font-medium text-red-300">{error}</p>}
          </div>

          {result && (
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-semibold text-ink">{result.mode}</h2>
                  <p className="mt-1 text-xs text-slate-400">Based on {result.sources.length} sources</p>
                </div>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="p-5 sm:p-6">
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
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{f.text}</p>
                        <p className="mt-2 text-xs font-semibold text-blue-700">
                          {f.sources.map((n) => result.sources[n - 1]?.title).filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 xl:self-start">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Sources</h2>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
              {selected.length}/{MAX_SOURCES}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-slate-400">Clip some articles or import PDFs to analyze them here.</p>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto">
              {items.map((i) => {
                const on = selected.includes(i._id);
                return (
                  <label
                    key={i._id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                      on ? "border-blue-200 bg-blue-50/50" : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(i._id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-xs font-semibold leading-5 text-slate-700">
                        {i.source?.title ?? "Untitled"}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {i.source?.domain ?? i.source?.fileName ?? "PDF"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}