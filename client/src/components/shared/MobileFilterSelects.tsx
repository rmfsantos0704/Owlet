import { useEffect, useState } from "react";
import type { FilterSelect } from "./FilterBar";

const QUERY = "(max-width: 639px)";

// true below Tailwind's `sm` breakpoint
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

// One row of equal-width dropdowns, each with its title above it, for phones.
export default function MobileFilterSelects({ selects }: { selects: FilterSelect[] }) {
  if (selects.length === 0) return null;
  return (
    <div className="mb-3 grid grid-flow-col auto-cols-fr gap-2">
      {selects.map((s) => (
        <div key={s.id} className="min-w-0">
          <label htmlFor={`m-${s.id}`} className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {s.label}
          </label>
          <select
            id={`m-${s.id}`}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            className="field !w-full min-w-0 truncate !px-2 !py-1.5 !text-xs"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}