import {
  useEffect, useLayoutEffect, useRef, useState,
  type ComponentProps, type PointerEvent,
} from "react";
import { GripHorizontal, X } from "lucide-react";
import CommentThread from "./CommentThread";

// Same props as CommentThread, plus open/close
type Props = ComponentProps<typeof CommentThread> & {
  open: boolean;
  onClose: () => void;
};

// keep the panel on screen, and always keep its header reachable
const clamp = (x: number, y: number, el: HTMLElement) => ({
  x: Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth)),
  y: Math.max(0, Math.min(y, window.innerHeight - 56)),
});

export default function CommentsModal({ open, onClose, ...thread }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // first open: place it near the top, horizontally centered. Later opens remember where you left it.
  useLayoutEffect(() => {
    if (!open || pos || !panelRef.current) return;
    const el = panelRef.current;
    setPos(clamp((window.innerWidth - el.offsetWidth) / 2, 96, el));
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos((p) => (p && panelRef.current ? clamp(p.x, p.y, panelRef.current) : p));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

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

  // kept mounted (just hidden) so a half-written comment survives closing the popup
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Comments"
      style={pos ? { left: pos.x, top: pos.y } : { visibility: "hidden" }}
      className={`fixed z-50 h-[min(34rem,calc(100vh-2rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 ${
        open ? "flex" : "hidden"
      }`}
    >
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="flex cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="size-4 text-slate-400" />
          <h2 className="font-semibold text-ink">Comments ({thread.comments.length})</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments"
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>

<div className="min-h-0 flex-1">
        <CommentThread {...thread} />
      </div>
    </div>
  );
}