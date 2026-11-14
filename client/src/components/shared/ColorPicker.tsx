import { Check } from "lucide-react";
import { COLOR_STYLES, HIGHLIGHT_COLORS } from "../../utils/colors";

type Props = { value: string; onChange: (color: string) => void; disabled?: boolean };

export default function ColorPicker({ value, onChange, disabled }: Props) {
  return (
    // one row on phones: the swatches share the width equally and shrink to fit (no wrapping, no scrolling)
    <div
      role="radiogroup"
      aria-label="Highlight color"
      className="flex w-full flex-nowrap items-center justify-between gap-1 sm:w-auto sm:flex-wrap sm:justify-start sm:gap-2"
    >
      {HIGHLIGHT_COLORS.map((c) => {
        const s = COLOR_STYLES[c];
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={s.label}
            title={s.label}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`flex aspect-square min-w-0 max-w-6 flex-1 items-center justify-center rounded-full sm:size-6 sm:max-w-none sm:flex-none ${s.dot} ${
              on ? "ring-2 ring-brand ring-offset-1 sm:ring-offset-2" : "opacity-70 hover:opacity-100"
            }`}
          >
            {on && <Check className="size-2.5 text-slate-700 sm:size-3.5" />}
          </button>
        );
      })}
    </div>
  );
}