import { useRef, useState } from "react";
import { COLORS } from "../utils/colors";

type Props = {
  text: string;
  readOnly?: boolean;
  onHighlight: (text: string, color: string, note?: string) => Promise<void>;
};

export default function ClippedText({ text, readOnly, onHighlight }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");

  function capture() {
    const sel = window.getSelection();
    const t = sel?.toString().trim() ?? "";
    if (t && sel?.anchorNode && ref.current?.contains(sel.anchorNode)) setSelected(t.slice(0, 2000));
  }

  async function save(color: string) {
    await onHighlight(selected, color, note.trim() || undefined);
    setSelected("");
    setNote("");
    window.getSelection()?.removeAllRanges();
  }

  return (
    <div>
      {!readOnly && <p className="mb-2 text-xs text-slate-400">Select text below to highlight it.</p>}
      <p
        ref={ref}
        onMouseUp={readOnly ? undefined : capture}
        className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
      >
        {text}
      </p>
      {!readOnly && selected && (
        <div className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="line-clamp-3 text-sm italic text-slate-700">&ldquo;{selected}&rdquo;</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="field" />
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(COLORS).map((c) => (
              <button key={c} onClick={() => save(c)} className={`rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 ${COLORS[c]}`}>
                {c}
              </button>
            ))}
            <button onClick={() => setSelected("")} className="ml-auto text-xs font-medium text-slate-500 underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}