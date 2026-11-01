import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileText, FolderOpen, Search, UsersRound } from "lucide-react";
import { createPortal } from "react-dom";

export type FilterSelect = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
};

const SELECT_ICONS = {
  collection: FolderOpen,
  clip: FileText,
  user: UsersRound,
} as const;

function FilterDropdown({ select }: { select: FilterSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = SELECT_ICONS[select.id as keyof typeof SELECT_ICONS];
  const selected = select.options.find((option) => option.value === select.value);
  const searchable = select.options.length > 8;
  const visibleOptions = select.options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(256, window.innerWidth - 16);
      const height = Math.min(308, (searchable ? 60 : 0) + Math.min(240, Math.max(visibleOptions.length, 1) * 36) + 2);
      const top = window.innerHeight - rect.bottom < height + 8 && rect.top > height
        ? rect.top - height
        : rect.bottom + 4;
      setPosition({
        top,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    }
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
        setPosition(null);
      }
    }
    updatePosition();
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, searchable, visibleOptions.length]);

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus();
  }, [open, searchable]);

  function close() {
    setOpen(false);
    setQuery("");
    setPosition(null);
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${select.className ?? "w-40"} max-w-full shrink-0`}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${select.label}: ${selected?.label ?? "None"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label}
        onClick={() => {
          if (open) close();
          else {
            setQuery("");
            setOpen(true);
          }
        }}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
      >
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? "Choose…"}</span>
        <ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && position && createPortal(
        <div
          ref={popupRef}
          style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
          className="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {searchable && (
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={`Search ${select.label.toLowerCase()}`}
                  placeholder={`Search ${select.label.toLowerCase()}…`}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          )}
          <div role="listbox" aria-label={select.label} className="max-h-60 overflow-y-auto p-1">
            {visibleOptions.length ? (
              visibleOptions.map((option) => {
                const isSelected = option.value === select.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    title={option.label}
                    onClick={() => {
                      select.onChange(option.value);
                      close();
                    }}
                    className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs transition ${
                      isSelected ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-3 text-xs text-slate-400">No matches found.</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

type Props = {
  selects: FilterSelect[];
  /** True when any search/filter is applied, which shows the "Clear" button. */
  active: boolean;
  onClear: () => void;
  shown: number;
  total: number;
  noun: string;
  topActions?: ReactNode;
  filterControls?: ReactNode;
};

export default function FilterBar({
  selects,
  active,
  onClear,
  shown,
  total,
  noun,
  topActions,
  filterControls,
}: Props) {
  return (
    <div className="space-y-3">
      {selects.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {selects.map((s) => (
            <FilterDropdown key={s.id} select={s} />
          ))}
          {topActions}
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {filterControls}
        <div className="ml-auto flex shrink-0 items-center gap-3 text-[11px] text-slate-400">
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
    </div>
  );
}