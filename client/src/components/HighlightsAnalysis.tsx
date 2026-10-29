import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../services/api";
import Modal from "./Modal";

/** The ask endpoint takes at most this many sources per run. */
export const MAX_ANALYSIS_SOURCES = 8;

const ANALYSIS_PROMPT =
  "Analyze only the passages the user highlighted in these sources. Synthesize them into: " +
  "(1) recurring themes, (2) the key claims being made, and (3) open questions or gaps. " +
  "Start every finding title with exactly one prefix: 'Theme:', 'Claim:' or 'Open question:'. " +
  "Cite the highlighted passages as evidence.";

type Finding = { title: string; text: string; sources: number[] };
type Analysis = { summary: string; findings: Finding[]; sources: { id: string; title: string }[] };

const SECTIONS = [
  { key: "theme", label: "Themes", tone: "bg-violet-50 text-violet-700" },
  { key: "claim", label: "Claims", tone: "bg-blue-50 text-blue-700" },
  { key: "question", label: "Open questions", tone: "bg-amber-50 text-amber-700" },
  { key: "other", label: "Other findings", tone: "bg-slate-100 text-slate-600" },
] as const;

// Findings come back with a "Theme:" / "Claim:" / "Open question:" title prefix; use it to sort them into sections.
function sectionOf(title: string): { key: (typeof SECTIONS)[number]["key"]; title: string } {
  const m = title.match(/^\s*(theme|claim|open question)s?\s*[:\-–—]\s*(.*)$/i);
  if (!m) return { key: "other", title };
  const k = m[1].toLowerCase();
  return { key: k === "theme" ? "theme" : k === "claim" ? "claim" : "question", title: m[2] || title };
}

type Props = {
  /** The highlights the person picked, each with the clip it belongs to. */
  selected: { id: string; itemId: string }[];
  /** How many highlights are currently shown, for the "select all shown" button. */
  shownCount: number;
  /** A message about the selection (e.g. the source limit was hit). */
  notice?: string;
  /** Changing this clears the last analysis (e.g. when the collection changes). */
  resetKey?: string;
  onSelectAll: () => void;
  onClear: () => void;
};

export default function HighlightsAnalysis({ selected, shownCount, notice, resetKey, onSelectAll, onClear }: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setAnalysis(null);
    setOpen(false);
    setError("");
  }, [resetKey]);

  const itemIds = [...new Set(selected.map((s) => s.itemId))];

  async function analyze() {
    if (analyzing || selected.length === 0) return;
    setAnalyzing(true);
    setError("");
    try {
      const r = await api<Analysis>("/research/ask", {
        method: "POST",
        body: {
          itemIds,
          // the exact highlights to analyze; the clips above are what the endpoint reads today
          highlightIds: selected.map((s) => s.id),
          mode: "Research brief",
          prompt: ANALYSIS_PROMPT,
          title: "Highlights analysis",
        },
      });
      setAnalysis({ summary: r.summary, findings: r.findings, sources: r.sources });
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-brand p-5 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-cyan-300" />
          <h2 className="font-semibold">Connect the patterns</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-blue-100/70">
          Ask Owlet to synthesize your highlights into themes, claims, and open questions.
        </p>

        <div className="mt-3 rounded-xl bg-white/10 p-3">
          <p className="text-[11px] leading-4 text-blue-100/80">
            {selected.length === 0
              ? "Tick the highlights you want Owlet to analyze, or select everything shown."
              : `${selected.length} highlight${selected.length === 1 ? "" : "s"} selected from ${itemIds.length} source${
                  itemIds.length === 1 ? "" : "s"
                }.`}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={shownCount === 0}
              className="text-cyan-300 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select all shown ({shownCount})
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={onClear} className="text-blue-100/70 hover:underline">
                Clear
              </button>
            )}
          </div>
          {notice && <p className="mt-2 text-[11px] leading-4 text-amber-200">{notice}</p>}
        </div>

        <button
          type="button"
          onClick={analyze}
          disabled={analyzing || selected.length === 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-bold text-brand hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="size-3.5" />
          {analyzing ? "Analyzing…" : "Analyze highlights"}
        </button>
        {analysis && !analyzing && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 w-full rounded-xl border border-white/20 py-2 text-xs font-semibold text-blue-100 hover:bg-white/10"
          >
            View last analysis
          </button>
        )}
        {error && <p className="mt-3 text-xs font-medium text-red-300">{error}</p>}
      </div>

      {analysis && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Highlights analysis"
          maxWidth="max-w-3xl"
          footer={
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]"
            >
              Close
            </button>
          }
        >
          <div>
            <p className="mb-4 text-xs text-slate-400">Based on {analysis.sources.length} sources</p>
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="eyebrow mb-2 text-blue-600">Summary</div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{analysis.summary}</p>
            </div>
            <div className="space-y-6">
              {SECTIONS.map((s) => {
                const list = analysis.findings
                  .map((f) => ({ f, p: sectionOf(f.title) }))
                  .filter((x) => x.p.key === s.key);
                if (list.length === 0) return null;
                return (
                  <div key={s.key}>
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">{s.label}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.tone}`}>{list.length}</span>
                    </div>
                    <div className="space-y-4">
                      {list.map(({ f, p }, i) => (
                        <div key={i} className="rounded-xl border border-slate-100 p-4">
                          <h4 className="text-sm font-semibold text-slate-800">{p.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{f.text}</p>
                          <p className="mt-2 text-xs font-semibold text-blue-700">
                            {f.sources.map((n) => analysis.sources[n - 1]?.title).filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}