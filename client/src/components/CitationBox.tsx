import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CitationBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}