import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, TriangleAlert, X } from "lucide-react";

export type Notice = { text: string; error: boolean };

const AUTO_DISMISS_MS = 5000;

// A small card in the bottom-right corner. Success messages go away on their own; errors stay until dismissed.
export default function Toast({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[110] flex justify-end sm:inset-x-auto sm:bottom-6 sm:right-6">
      <div
        role={notice.error ? "alert" : "status"}
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-xl shadow-slate-900/15 ${
          notice.error ? "border-red-200" : "border-emerald-200"
        }`}
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            notice.error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {notice.error ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
        </span>
        <p className="max-h-40 min-w-0 flex-1 overflow-y-auto break-words pt-1 text-sm leading-5 text-slate-700">
          {notice.text}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}