import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

type Props = {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  selects: FilterSelect[];
  /** True when any search/filter is applied, which shows the "Clear" button. */
  active: boolean;
  onClear: () => void;
  shown: number;
  total: number;
  noun: string;
  /** Extra controls rendered under the dropdowns (e.g. color chips). */
  children?: ReactNode;
};

export default function FilterBar({
  search,
  onSearch,
  placeholder,
  selects,
  active,
  onClear,
  shown,
  total,
  noun,
  children,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {selects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selects.map((s) => (
            <select
              key={s.id}
              value={s.value}
              onChange={(e) => s.onChange(e.target.value)}
              aria-label={s.label}
              title={s.label}
              className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:max-w-[220px]"
            >
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {children}

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Showing {shown} of {total} {noun}
        </span>
        {active && (
          <button type="button" onClick={onClear} className="font-semibold text-blue-700 hover:underline">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}