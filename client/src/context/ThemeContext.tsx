import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    // While the session is still being checked (the loading screen), apply the saved theme too,
    // so the loader isn't white for someone who uses dark mode. Login and similar pages stay light.
    const dark = theme === "dark" && (loading || !!user) && !AUTH_PATHS.has(pathname);
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The preference still applies for this session when storage is unavailable.
    }
  }, [theme, pathname, user, loading]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}