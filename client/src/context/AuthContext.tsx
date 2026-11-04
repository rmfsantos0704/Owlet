import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, AI_QUOTA_EXHAUSTED_EVENT, AI_USAGE_UPDATED_EVENT } from "../services/api";
import { clearSessionToken, setSessionToken } from "../services/session";

type User = { id?: string; email: string };
type AiDailyUsage = { used: number; limit: number; remaining: number };
type Session = { user: User; features?: { ai?: boolean; aiUsage?: AiDailyUsage } };

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
  aiUsage: AiDailyUsage | null;
  login: (email: string, password: string) => Promise<void>;
  // creating an account does NOT log you in: the user must confirm their email first
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiUsage, setAiUsage] = useState<AiDailyUsage | null>(null);
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
          setAiUsage(r.features?.aiUsage ?? null);
        })
        .catch((e) => {
          if (cancelled) return;
          // only a rejected login ends the session; a network hiccup or server error must not log anyone out
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) clearSessionToken();
          setUser(null);
          setAiEnabled(false);
          setAiUsage(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    const refreshAiAvailability = () => {
      api<Session>("/auth/me")
        .then((r) => {
          if (!cancelled) {
            setAiEnabled(!!r.features?.ai);
            setAiUsage(r.features?.aiUsage ?? null);
          }
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            clearSessionToken();
            setUser(null);
            setAiEnabled(false);
            setAiUsage(null);
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
        setAiUsage(null);
      }
    };
    const onAiQuotaExhausted = () => {
      setAiEnabled(false);
      refreshAiAvailability();
    };
    const onAiUsageUpdated = () => refreshAiAvailability();
    window.addEventListener("storage", onStorage);
    window.addEventListener(AI_QUOTA_EXHAUSTED_EVENT, onAiQuotaExhausted);
    window.addEventListener(AI_USAGE_UPDATED_EVENT, onAiUsageUpdated);

    return () => {
      cancelled = true;
      window.clearTimeout(quotaResetTimer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AI_QUOTA_EXHAUSTED_EVENT, onAiQuotaExhausted);
      window.removeEventListener(AI_USAGE_UPDATED_EVENT, onAiUsageUpdated);
    };
  }, []);

  const value: AuthValue = {
    user,
    loading,
    aiEnabled,
    aiUsage,
    login: async (email, password) => {
      const r = await api<Session & { token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSessionToken(r.token);
      setUser(r.user);
      setAiEnabled(!!r.features?.ai);
      setAiUsage(r.features?.aiUsage ?? null);
    },
    register: async (input) => {
      await api("/auth/register", { method: "POST", body: input });
    },
    logout: () => {
      clearSessionToken();
      setUser(null);
      setAiEnabled(false);
      setAiUsage(null);
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