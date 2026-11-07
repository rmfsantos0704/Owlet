import { useEffect, useState } from "react";

// A small spinning ring. Use it inline (buttons, cards).
export function Spinner({ className = "size-8" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  label?: string;
  /**
   * "screen": the whole window (app start-up).
   * "page": the content area of a page inside the app layout.
   * "parent": whatever box it is placed in.
   */
  fill?: "screen" | "page" | "parent";
};

const BOX = {
  screen: "min-h-dvh bg-canvas",
  page: "min-h-[60vh]",
  parent: "h-full min-h-64",
};

const OWL = {
  screen: "size-48 sm:size-64",
  page: "size-36 sm:size-48",
  parent: "size-32 sm:size-44",
};

export default function LoadingScreen({ label = "Loading…", fill = "screen" }: Props) {
  // shown only after a short moment, so quick loads don't flash the owl
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center ${BOX[fill]}`}>
      {show && (
        <div className="flex flex-col items-center gap-4">
          <img src="/owl.png" alt="" draggable={false} className={`select-none object-contain ${OWL[fill]}`} />
          <Spinner className="size-8" />
          <p className="animate-pulse text-sm font-medium text-slate-500">{label}</p>
        </div>
      )}
    </div>
  );
}