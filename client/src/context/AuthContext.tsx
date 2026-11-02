import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, AI_QUOTA_EXHAUSTED_EVENT } from "../services/api";

type User = { id?: string; email: string };
type Session = { user: User; features?: { ai?: boolean } };

export type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
  acceptTerms: boolean;
};

type AuthValue = {
  user: User | null;
  loading: boolean;
  aiEnabled: boolean; // server feature flag and this account's daily allowance
  login: (email: string, password: string) => Promise<void>;
  // creating an account does NOT log you in: the user must confirm their email first
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    let cancelled = false;
    let quotaResetTimer: number;

    const load = () => {
      api<Session>("/auth/me")
        .then((r) => {
          if (cancelled) return;
          setUser(r.user);
          setAiEnabled(!!r.features?.ai);
        })
        .catch((e) => {
          if (cancelled) return;
          // only a rejected login ends the session; a network hiccup or server error must not log anyone out
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    const refreshAiAvailability = () => {
      api<Session>("/auth/me")
        .then((r) => {
          if (!cancelled) setAiEnabled(!!r.features?.ai);
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            localStorage.removeItem("token");
            setUser(null);
            setAiEnabled(false);
          } else {
            console.warn("Could not refresh AI availability.", e);
          }
        });
    };

    if (localStorage.getItem("token")) load();

    const scheduleQuotaReset = () => {
      const now = new Date();
      const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 1);
      quotaResetTimer = window.setTimeout(() => {
        if (localStorage.getItem("token")) refreshAiAvailability();
        scheduleQuotaReset();
      }, nextUtcDay - now.getTime());
    };
    scheduleQuotaReset();

    // another tab (or the extension) logged in or out: follow it
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || (e.key !== "token" && e.key !== null)) return;
      if (localStorage.getItem("token")) load();
      else {
        setUser(null);
        setAiEnabled(false);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearTimeout(quotaResetTimer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onAiQuotaExhausted = () => setAiEnabled(false);
    window.addEventListener(AI_QUOTA_EXHAUSTED_EVENT, onAiQuotaExhausted);
    return () => window.removeEventListener(AI_QUOTA_EXHAUSTED_EVENT, onAiQuotaExhausted);
  }, []);

  const value: AuthValue = {
    user,
    loading,
    aiEnabled,
    login: async (email, password) => {
      const r = await api<Session & { token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      localStorage.setItem("token", r.token);
      setUser(r.user);
      setAiEnabled(!!r.features?.ai);
    },
    register: async (input) => {
      await api("/auth/register", { method: "POST", body: input });
    },
    logout: () => {
      localStorage.removeItem("token");
      setUser(null);
      setAiEnabled(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}