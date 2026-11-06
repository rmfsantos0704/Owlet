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

const DEFAULT_SIZE = "h-[min(34rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-1rem))]";
const MIN_W = 280;
const MIN_H = 200;

// shared by every popup so the one you touch last comes to the front
let topZ = 50;

// Keep the full panel, including its footer, inside the viewport.
const clamp = (x: number, y: number, el: HTMLElement) => ({
  x: Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth)),
  y: Math.max(0, Math.min(y, window.innerHeight - el.offsetHeight)),
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
  const resizeGrab = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // null = use the default size classes; set once the person resizes the panel
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [z, setZ] = useState(50);

  // opening brings it to the front
  useLayoutEffect(() => {
    if (open) setZ(++topZ);
  }, [open]);

  // first open: place it near the top. Later opens remember where you left it.
  // Also re-clamps after a size change (for example the reset) so it never hangs off screen.
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const el = panelRef.current;
    if (pos) {
      const next = clamp(pos.x, pos.y, el);
      if (next.x !== pos.x || next.y !== pos.y) setPos(next);
      return;
    }
    const x = align === "right" ? window.innerWidth - el.offsetWidth - 24 : (window.innerWidth - el.offsetWidth) / 2;
    setPos(clamp(x, 96, el));
  }, [open, pos, size, align]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      // shrink a resized panel if the window became smaller than it
      setSize((s) => (s ? { w: Math.min(s.w, window.innerWidth), h: Math.min(s.h, window.innerHeight) } : s));
      setPos((p) => (p && panelRef.current ? clamp(p.x, p.y, panelRef.current) : p));
    };
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

  function onResizeDown(e: PointerEvent<HTMLDivElement>) {
    if (!panelRef.current) return;
    e.preventDefault();
    resizeGrab.current = {
      x: e.clientX,
      y: e.clientY,
      w: panelRef.current.offsetWidth,
      h: panelRef.current.offsetHeight,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: PointerEvent<HTMLDivElement>) {
    const g = resizeGrab.current;
    if (!g || !pos) return;
    // the panel can grow until it reaches the right and bottom edges of the window
    const maxW = window.innerWidth - pos.x;
    const maxH = window.innerHeight - pos.y;
    const w = Math.max(Math.min(MIN_W, maxW), Math.min(g.w + e.clientX - g.x, maxW));
    const h = Math.max(Math.min(MIN_H, maxH), Math.min(g.h + e.clientY - g.y, maxH));
    setSize({ w, h });
  }

  const onResizeUp = () => {
    resizeGrab.current = null;
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
      style={{
        zIndex: z,
        ...(size ? { width: size.w, height: size.h } : {}),
        ...(pos ? { left: pos.x, top: pos.y } : { visibility: "hidden" }),
      }}
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

      {/* resize grip: drag to resize, double-click to reset to the default size */}
      <div
        role="separator"
        aria-label="Resize"
        title="Drag to resize. Double-click to reset."
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onDoubleClick={() => setSize(null)}
        className="absolute bottom-0 right-0 z-10 flex size-4 cursor-nwse-resize touch-none select-none items-end justify-end p-0.5 text-slate-400 hover:text-slate-600"
      >
        <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M9 3L3 9M9 6.5L6.5 9" />
        </svg>
      </div>
    </div>
  );
}