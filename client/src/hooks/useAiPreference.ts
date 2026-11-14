import { useCallback, useSyncExternalStore } from "react";

// "Generate an AI summary for new clips (PDF imports and saved links)". Remembered on this device and shared by
// every control on the page that shows it, so flipping one flips the others.
const KEY = "owlet.useAi";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

let current = typeof window === "undefined" ? true : read();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // another tab changed it
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = read();
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAiPreference(): [boolean, (next: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => current, () => true);
  const set = useCallback((next: boolean) => {
    current = next;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [on, set];
}