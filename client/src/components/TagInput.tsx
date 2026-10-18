import { useState } from "react";
import { X } from "lucide-react";

type Props = { tags: string[]; onChange: (t: string[]) => void; readOnly?: boolean };

export default function TagInput({ tags, onChange, readOnly }: Props) {
  const [value, setValue] = useState("");

  function add() {
    const t = value.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 20) onChange([...tags, t]);
    setValue("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="chip flex items-center gap-1">
          {t}
          {!readOnly && (
            <button onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-slate-400 hover:text-red-600">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
          placeholder="Add tag…"
          className="field !w-28 !rounded-md !px-2 !py-1 !text-xs"
        />
      )}
    </div>
  );
}