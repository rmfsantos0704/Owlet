import { useState } from "react";

export default function CitationBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded border bg-white p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
        <button onClick={copy} className="text-xs underline">{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}