import { useState } from "react";
import { ChevronRight, Library } from "lucide-react";
import DraggableModal from "./DraggableModal";
import type { ResearchItem } from "../types";

type Props = {
  items: ResearchItem[];
  selected: string[];
  max: number;
  onToggle: (id: string) => void;
};

export default function Sources({ items, selected, max, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  const atLimit = selected.length >= max;
  const selectedItems = items.filter((i) => selected.includes(i._id));
  const preview = selectedItems
    .slice(0, 2)
    .map((i) => i.source?.title ?? "Untitled")
    .join(", ");
  const extra = selectedItems.length - 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Library className="size-4" />
            </span>
            <h2 className="font-semibold text-ink">Sources</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
              {selected.length}/{max}
            </span>
            <ChevronRight className="size-4 text-slate-300 transition group-hover:text-blue-500" />
          </div>
        </div>
        <p className="mt-3 truncate text-xs leading-5 text-slate-400">
          {items.length === 0
            ? "Clip some articles or import PDFs to analyze them here."
            : selectedItems.length === 0
              ? "No sources selected. Choose which ones to analyze."
              : `${preview}${extra > 0 ? ` +${extra} more` : ""}`}
        </p>
      </button>

      <DraggableModal
        open={open}
        onClose={() => setOpen(false)}
        title="Sources"
        align="right"
        footer={
          <>
            <span className="mr-auto self-center text-xs text-slate-400">
              {selected.length}/{max} selected{atLimit ? " · limit reached" : ""}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]"
            >
              Done
            </button>
          </>
        }
      >
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Clip some articles or import PDFs to analyze them here.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((i) => {
              const on = selected.includes(i._id);
              const blocked = !on && atLimit;
              return (
                <label
                  key={i._id}
                  className={`flex gap-3 rounded-xl border p-3 transition ${
                    on ? "border-blue-200 bg-blue-50/50" : "border-slate-100"
                  } ${blocked ? "cursor-not-allowed opacity-50" : on ? "cursor-pointer" : "cursor-pointer hover:bg-slate-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={blocked}
                    onChange={() => onToggle(i._id)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-sm font-semibold leading-5 text-slate-700">
                      {i.source?.title ?? "Untitled"}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {i.source?.domain ?? i.source?.fileName ?? "PDF"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </DraggableModal>
    </>
  );
}