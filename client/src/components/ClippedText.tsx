import { useEffect, useMemo, useRef, useState } from "react";
import { Highlighter } from "lucide-react";
import type { Highlight } from "../types";
import ColorPicker from "./ColorPicker";
import { styleFor } from "../utils/colors";

type Props = {
  text: string;
  highlights?: Highlight[];
  readOnly?: boolean;
  /** Should throw on failure so the form keeps what was typed. */
  onHighlight: (text: string, color: string, note?: string) => Promise<unknown> | void;
};

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

type Segment = { text: string; h?: Highlight };

// Highlights store their text, not positions, so each one is matched to its first free spot in the clip.
// Whitespace is matched loosely because a selection can differ from the clip in line breaks.
function buildSegments(text: string, highlights: Highlight[]): Segment[] {
  const ranges: { start: number; end: number; h: Highlight }[] = [];
  for (const h of highlights) {
    const needle = h.text.trim();
    if (!needle) continue;
    const rx = new RegExp(needle.split(/\s+/).map(escapeRx).join("\\s+"), "g");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (!ranges.some((r) => start < r.end && end > r.start)) {
        ranges.push({ start, end, h });
        break;
      }
      rx.lastIndex = m.index + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.end), h: r.h });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

export default function ClippedText({ text, highlights = [], readOnly, onHighlight }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState("");
  const [color, setColor] = useState<string>("yellow");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const segments = useMemo(() => buildSegments(text, highlights), [text, highlights]);

  // on small screens the panel sits below the text, so bring it into view after a selection
  useEffect(() => {
    if (pending && window.innerWidth < 768) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [pending]);

  // remember the selected text, because clicking a color button clears the browser's selection
  function captureSelection() {
    if (readOnly) return;
    const sel = window.getSelection();
    const box = boxRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !box) return;
    if (!box.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    const t = sel.toString().trim();
    if (!t) return;
    if (t.length > 2000) {
      setPending("");
      setError("Select at most 2000 characters at a time.");
      return;
    }
    setError("");
    setPending(t);
  }

  function cancel() {
    setPending("");
    setNote("");
    setError("");
    window.getSelection()?.removeAllRanges();
  }

  async function save() {
    if (!pending || saving) return;
    setSaving(true);
    setError("");
    try {
      await onHighlight(pending, color, note.trim() || undefined);
      setPending("");
      setNote("");
      window.getSelection()?.removeAllRanges();
    } catch {
      setError("Could not save the highlight. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!text) return <p className="text-sm text-slate-400">No text saved for this clip.</p>;

  return (
<div className={`grid gap-4 ${readOnly ? "" : "md:grid-cols-[minmax(0,1fr)_15rem]"}`}>
      {/* Left: the text, scrolling on its own */}
      <div
        ref={boxRef}
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
        className="max-h-[50vh] min-w-0 overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-relaxed text-slate-700 md:max-h-[65vh]"
      >
        {segments.map((s, i) =>
          s.h ? (
            <mark key={i} title={s.h.note || undefined} className={`rounded px-0.5 text-slate-900 ${styleFor(s.h.color).mark}`}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>

      {/* Right: the highlight panel */}
      {!readOnly && (
<div ref={panelRef} className="self-start rounded-xl border border-slate-200 bg-slate-50 p-3">
          {pending ? (
            <div className="space-y-3">
              <p className="break-words text-xs italic leading-5 text-slate-600">“{clip(pending)}”</p>
              <ColorPicker value={color} onChange={setColor} disabled={saving} />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                placeholder="Add a note (optional)"
                aria-label="Highlight note"
                className="field"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={cancel} disabled={saving} className="btn-secondary">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : "Add highlight"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Highlighter className="size-5" />
              </span>
              <p className="text-sm font-medium text-slate-600">Select text to highlight</p>
<p className="text-xs text-slate-400">Pick a color, add a note.</p>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}