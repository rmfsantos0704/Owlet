import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export function AppButton({ children, className = "", onClick, title, disabled, type = "button" }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${className}`}
      onClick={onClick}
      title={title}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// the big navy button used for each page's main action
export function PrimaryButton({
  children,
  busy,
  busyLabel = "Please wait…",
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <AppButton
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full rounded-lg bg-[#102b5c] py-3.5 text-base font-bold text-white shadow-sm hover:bg-[#173b77] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <LoaderCircle className="mr-2 size-4 animate-spin" /> {busyLabel}
        </>
      ) : (
        children
      )}
    </AppButton>
  );
}

// small text-style button, e.g. "Resend email"
export function TextButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <AppButton
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
    >
      {children}
    </AppButton>
  );
}