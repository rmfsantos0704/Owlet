import { useEffect, useState } from "react";

// Counts down once per second, e.g. to stop "Resend email" from being spammed.
export function useCooldown() {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return { left, start: (seconds = 60) => setLeft(seconds) };
}