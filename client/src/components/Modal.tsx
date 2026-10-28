import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string; // a Tailwind max-width class, e.g. "max-w-lg"
  hideClose?: boolean;
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Owlet's own dialog: used instead of the browser's built-in alert / confirm / prompt boxes.
// Closes on Esc or a click on the backdrop, keeps Tab inside, locks page scroll, and gives focus back when it closes.
export default function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-md", hideClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    // focus whatever asked for it (autoFocus), otherwise the first control
    queueMicrotask(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[calc(100vh-2rem)] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-6 py-4 text-sm leading-6 text-slate-600">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}