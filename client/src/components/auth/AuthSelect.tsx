import { useId } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

type Props = {
  placeholder: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  error?: string;
};

export default function AuthSelect({ placeholder, icon: Icon, value, onChange, options, error }: Props) {
  const id = useId();
  return (
    <div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
        <select
          id={id}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-12 w-full cursor-pointer appearance-none rounded-xl border bg-white pl-11 pr-11 text-sm outline-none transition focus:ring-4 ${
            value ? "text-slate-800" : "text-slate-400"
          } ${
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-50"
              : "border-slate-200 focus:border-blue-400 focus:ring-blue-50"
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-slate-800">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}