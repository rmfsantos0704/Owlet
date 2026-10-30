import {
  useEffect, useLayoutEffect, useRef, useState,
  type PointerEvent, type ReactNode,
} from "react";
import { GripHorizontal, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Let the body scroll and pad it. Pass false if the content manages its own scrolling. */
  scroll?: boolean;
  /** Where it first appears. Later opens remember where you left it. */
  align?: "center" | "right";
  /** Replaces the default size classes. */
  className?: string;
};

const DEFAULT_SIZE = "h-[min(34rem,calc(100vh-2rem))] w-[min(26rem,calc(100vw-1rem))]";

// shared by every popup so the one you touch last comes to the front
let topZ = 50;

// keep the panel on screen, and always keep its header reachable
const clamp = (x: number, y: number, el: HTMLElement) => ({
  x: Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth)),
  y: Math.max(0, Math.min(y, window.innerHeight - 56)),
});

export default function DraggableModal({
  open,
  onClose,
  title,
  children,
  footer,
  scroll = true,
  align = "center",
  className = DEFAULT_SIZE,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [z, setZ] = useState(50);

  // opening brings it to the front
  useLayoutEffect(() => {
    if (open) setZ(++topZ);
  }, [open]);

  // first open: place it near the top. Later opens remember where you left it.
  useLayoutEffect(() => {
    if (!open || pos || !panelRef.current) return;
    const el = panelRef.current;
    const x = align === "right" ? window.innerWidth - el.offsetWidth - 24 : (window.innerWidth - el.offsetWidth) / 2;
    setPos(clamp(x, 96, el));
  }, [open, pos, align]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos((p) => (p && panelRef.current ? clamp(p.x, p.y, panelRef.current) : p));
    // Escape only closes the front-most popup
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && z === topZ) onClose();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, z]);

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (!pos || (e.target as HTMLElement).closest("button")) return;
    grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!grab.current || !panelRef.current) return;
    setPos(clamp(e.clientX - grab.current.dx, e.clientY - grab.current.dy, panelRef.current));
  }

  const onUp = () => {
    grab.current = null;
  };

  // kept mounted (just hidden) so anything half-typed inside survives closing the popup
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
      onPointerDownCapture={() => {
        if (z !== topZ) setZ(++topZ);
      }}
      style={{ zIndex: z, ...(pos ? { left: pos.x, top: pos.y } : { visibility: "hidden" }) }}
      className={`fixed flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 ${className} ${
        open ? "flex" : "hidden"
      }`}
    >
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripHorizontal className="size-4 shrink-0 text-slate-400" />
          <h2 className="truncate font-semibold text-ink">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className={`min-h-0 flex-1 ${scroll ? "overflow-y-auto p-4" : ""}`}>{children}</div>

      {footer && <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">{footer}</div>}
    </div>
  );
}