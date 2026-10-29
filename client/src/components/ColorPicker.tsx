import { Check } from "lucide-react";
import { COLOR_STYLES, HIGHLIGHT_COLORS } from "../utils/colors";

type Props = { value: string; onChange: (color: string) => void; disabled?: boolean };

export default function ColorPicker({ value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="Highlight color" className="flex flex-wrap items-center gap-2">
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
            className={`flex size-6 items-center justify-center rounded-full ${s.dot} ${
              on ? "ring-2 ring-brand ring-offset-2" : "opacity-70 hover:opacity-100"
            }`}
          >
            {on && <Check className="size-3.5 text-slate-700" />}
          </button>
        );
      })}
    </div>
  );
}