import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Theme = "light" | "dark";
type ThemeValue = { theme: Theme; setTheme: (theme: Theme) => void };

const STORAGE_KEY = "owlet.theme";
const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/confirm-email-change",
]);
const ThemeContext = createContext<ThemeValue | null>(null);

function parseTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : "light";
}

function readTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  // Only an explicit user choice writes to storage. Navigating never does,
  // so a stale tab can't overwrite the saved preference.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }
  }, []);

  // Keep other open tabs in sync when the preference changes in one of them.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(parseTheme(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Apply the class. While the session is still being checked (the loading screen), apply the
  // saved theme too, so the loader isn't white for someone who uses dark mode.
  // Login and similar pages stay light.
  useEffect(() => {
    const dark = theme === "dark" && (loading || !!user) && !AUTH_PATHS.has(pathname);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme, pathname, user, loading]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}