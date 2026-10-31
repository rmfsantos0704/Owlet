import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import Modal from "./Modal";
import { buildBrief, downloadMarkdown, type BriefHighlight, type GroupBy } from "../utils/brief";
import { styleFor } from "../utils/colors";

type Props = { open: boolean; onClose: () => void; highlights: BriefHighlight[]; initial?: string[] };

const clip = (s: string, n = 110) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export default function BriefModal({ open, onClose, highlights, initial }: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial ?? []));
  const [groupBy, setGroupBy] = useState<GroupBy>("source");
  const [copied, setCopied] = useState(false);

  const chosen = useMemo(() => highlights.filter((h) => picked.has(h.id)), [highlights, picked]);
  const markdown = useMemo(() => (chosen.length ? buildBrief(chosen, groupBy) : ""), [chosen, groupBy]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copy() {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text can still be selected in the box */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Build a brief"
      maxWidth="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button type="button" onClick={copy} disabled={!markdown} className="btn-secondary">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button type="button" onClick={() => downloadMarkdown(markdown)} disabled={!markdown} className="btn-primary">
            <Download className="size-4" /> Download .md
          </button>
        </>
      }
    >
      {highlights.length === 0 ? (
        <p className="text-sm text-slate-500">No highlights yet. Open a clip and select text to highlight it.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Tick the highlights you want. Owlet compiles them with your notes and an APA reference list. It all happens in
            your browser.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              {chosen.length} of {highlights.length} selected
            </span>
            <div className="flex gap-3 text-xs font-semibold">
              <button type="button" onClick={() => setPicked(new Set(highlights.map((h) => h.id)))} className="text-blue-700 hover:underline">
                Select all
              </button>
              <button type="button" onClick={() => setPicked(new Set())} className="text-slate-500 hover:underline">
                Clear
              </button>
            </div>
          </div>

          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
            {highlights.map((h) => (
              <li key={h.id}>
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-slate-50 ${
                    picked.has(h.id) ? "bg-slate-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(h.id)}
                    onChange={() => toggle(h.id)}
                    className="mt-0.5 size-4 shrink-0 accent-[#102b5c]"
                  />
                  <span className={`mt-1 size-2.5 shrink-0 rounded-full ${styleFor(h.color).dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-slate-800">“{clip(h.text)}”</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">{h.sourceTitle}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Group by</span>
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
              {(["source", "color"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${
                    groupBy === g ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <textarea
            readOnly
            value={markdown}
            rows={12}
            placeholder="Tick some highlights to see the brief here."
            aria-label="Brief preview (Markdown)"
            className="field mt-3 font-mono text-xs"
          />
        </>
      )}
    </Modal>
  );
}