import { useId, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { AppButton } from "./AppButton";

type Props = {
  label?: string;
  type?: "text" | "email" | "password" | "number";
  placeholder: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "email";
  min?: number;
  max?: number;
  maxLength?: number;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

export default function AuthField({
  label,
  type = "text",
  placeholder,
  icon: Icon,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  inputMode,
  min,
  max,
  maxLength,
  required,
  autoFocus,
  disabled,
}: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const note = error ?? hint;

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          className={`h-12 w-full rounded-xl border bg-white pl-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:opacity-60 ${
            isPassword ? "pr-11" : "pr-4"
          } ${
            error
              ? "border-red-400 focus:border-red-400 focus:ring-red-50"
              : "border-slate-200 focus:border-blue-400 focus:ring-blue-50"
          }`}
          type={isPassword && visible ? "text" : type}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          min={min}
          max={max}
          maxLength={maxLength}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {isPassword ? (
          <AppButton
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => setVisible(!visible)}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </AppButton>
        ) : null}
      </div>
      {note ? (
        <p id={`${id}-note`} className={`mt-1.5 text-xs ${error ? "font-medium text-red-600" : "text-slate-400"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}