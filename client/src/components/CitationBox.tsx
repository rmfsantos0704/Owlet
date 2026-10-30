import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

export default function CitationBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {/* inline font-size so no global button/Tailwind rule can override it */}
        <button
          onClick={copy}
          style={{ fontSize: 9, lineHeight: 1.2 }}
          className="flex items-center gap-1 font-medium text-blue-700 hover:underline"
        >
          {copied ? <Check size={9} /> : <Copy size={9} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* one line by default with the toggle always on its right; expanded, the text wraps (break-all so long links fit) */}
      <div className="flex items-start gap-3">
        <p
          className={`min-w-0 flex-1 text-xs leading-relaxed text-slate-700 ${expanded ? "break-all" : "truncate"}`}
        >
          {text}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ fontSize: 9, lineHeight: 1.2 }}
          className="flex shrink-0 items-center gap-1 font-medium text-slate-500 hover:text-blue-700"
        >
          <ChevronDown size={9} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : "Show all"}
        </button>
      </div>
    </div>
  );
}