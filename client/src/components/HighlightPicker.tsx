import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Highlight } from "../types";
import { styleFor } from "../utils/colors";

type Props = {
  highlights: Highlight[];
  /** The chosen highlight's id, or "" for a general comment. */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

const clip = (s: string, n = 80) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export default function HighlightPicker({ highlights, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selected = highlights.find((h) => h._id === value);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div onKeyDown={(e) => e.key === "Escape" && open && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Attach to a highlight"
        className="field flex w-full items-center gap-2 text-left"
      >
        {selected ? (
          <>
            <span className={`size-3 shrink-0 rounded-full ${styleFor(selected.color).dot}`} />
            <span className="min-w-0 flex-1 truncate">{clip(selected.text)}</span>
          </>
        ) : (
          <>
            <span className="size-3 shrink-0 rounded-full bg-slate-300" />
            <span className="flex-1 text-slate-600">General comment</span>
          </>
        )}
        <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul role="listbox" aria-label="Attach comment to" className="mt-1 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5">
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              onClick={() => pick("")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 ${!value ? "bg-slate-100 font-semibold" : ""}`}
            >
              <span className="size-3 shrink-0 rounded-full bg-slate-300" />
              <span className="flex-1">General comment</span>
              {!value && <Check className="size-3.5 shrink-0 text-slate-500" />}
            </button>
          </li>
          {highlights.map((h) => {
            const on = value === h._id;
            return (
              <li key={h._id} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => pick(h._id)}
                  className={`flex w-full items-center gap-2 rounded-r-lg border-l-4 px-3 py-2 text-left text-xs text-slate-700 hover:brightness-95 ${styleFor(h.color).quote} ${on ? "font-semibold" : ""}`}
                >
                  <span className="min-w-0 flex-1 break-words">{clip(h.text, 110)}</span>
                  {on && <Check className="size-3.5 shrink-0 text-slate-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}