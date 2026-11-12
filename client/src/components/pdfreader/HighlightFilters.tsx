import { Search } from "lucide-react";
import { styleFor } from "../../utils/colors";

type Props = {
  /** The colors the clip's highlights actually use. */
  colors: string[];
  query: string;
  onQuery: (value: string) => void;
  color: string | null;
  onColor: (color: string | null) => void;
  groupByPage: boolean;
  onGroupByPage: (value: boolean) => void;
  shown: number;
  total: number;
  onClear: () => void;
};

// Find your way around a long list: search the text and notes, filter by color, group by page.
export default function HighlightFilters({
  colors, query, onQuery, color, onColor, groupByPage, onGroupByPage, shown, total, onClear,
}: Props) {
  const filtering = query.trim() !== "" || color !== null;
  return (
    <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search highlights"
          aria-label="Search highlights"
          className="field !py-1.5 !pl-8 !text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {colors.length > 1 ? (
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by color">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColor(color === c ? null : c)}
                aria-pressed={color === c}
                aria-label={`${c} highlights`}
                title={c}
                className={`size-5 rounded-full border border-slate-300 ${styleFor(c).dot} ${
                  color === c ? "ring-2 ring-slate-700 ring-offset-1" : ""
                }`}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <input
            type="checkbox"
            checked={groupByPage}
            onChange={(e) => onGroupByPage(e.target.checked)}
            className="size-3.5 accent-[#102b5c]"
          />
          Group by page
        </label>
      </div>

      {filtering && (
        <p className="flex items-center justify-between text-[11px] text-slate-500" aria-live="polite">
          <span>
            Showing {shown} of {total}
          </span>
          <button type="button" onClick={onClear} className="font-semibold text-blue-700 hover:underline">
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
}