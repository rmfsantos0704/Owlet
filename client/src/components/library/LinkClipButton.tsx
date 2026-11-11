import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link2 } from "lucide-react";
import LinkClipper from "./LinkClipper";

type Saved = { id: string; title: string; aiFailed: boolean };

type Props = {
  collectionId: string;
  onSaved: (saved: Saved) => void;
};

// Header button that opens the "Save a link" form in a popover under it.
// The panel stays mounted while closed, so half-pasted text isn't lost.
export default function LinkClipButton({ collectionId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 64, left: 12, width: 380 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(420, window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
    setPos({ top: r.bottom + 8, left, width });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Save link"
        aria-label="Save link"
        className="btn-secondary !px-3 !py-2"
      >
        <Link2 className="size-4" />
        <span className="hidden 2xl:inline">Save link</span>
      </button>

      {createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Save a link"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className={`fixed z-30 max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ${open ? "" : "hidden"}`}
        >
          <h2 className="text-sm font-semibold text-ink">Save a link</h2>
          <p className="mt-1 text-xs text-slate-400">
            Paste a web page's address and Owlet saves its text and citations.
          </p>
          <div className="mt-3">
            <LinkClipper
              collectionId={collectionId}
              onSaved={(r) => {
                setOpen(false);
                onSaved(r);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}