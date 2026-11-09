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
  // AI can be used right now: the server has it on, the daily allowance isn't used up, and the person hasn't turned it off
  aiEnabled: boolean;
  // the person turned AI features off in their account (so pages can say so instead of "unavailable")
  aiOffByUser: boolean;
  aiUsage: AiDailyUsage | null;
  // turns AI features on or off for this account; throws if the server refuses
  setAiPreference: (enabled: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  // creating an account does NOT log you in: the user must confirm their email first
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false); // what the server says
  const [aiUserOn, setAiUserOn] = useState(true); // the person's own switch
  const [aiUsage, setAiUsage] = useState<AiDailyUsage | null>(null);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  // the person's own switch comes from the account, not from /auth/me
  const loadAiPreference = () =>
    api<{ enabled: boolean }>("/account/ai")
      .then((r) => setAiUserOn(r.enabled))
      .catch(() => {
        /* keep the last known value; the server enforces the setting either way */
      });

  useEffect(() => {
    let cancelled = false;
    let quotaResetTimer: number;

    const load = () => {
      api<Session>("/auth/me")
        .then((r) => {
          if (cancelled) return;
          setUser(r.user);
          setAiAvailable(!!r.features?.ai);
          setAiUsage(r.features?.aiUsage ?? null);
          void loadAiPreference();
        })
        .catch((e) => {
          if (cancelled) return;
          // only a rejected login ends the session; a network hiccup or server error must not log anyone out
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) clearSessionToken();
          setUser(null);
          setAiAvailable(false);
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
            setAiAvailable(!!r.features?.ai);
            setAiUsage(r.features?.aiUsage ?? null);
          }
        })
        .catch((e) => {
          if (cancelled) return;
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            clearSessionToken();
            setUser(null);
            setAiAvailable(false);
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
        setAiAvailable(false);
        setAiUsage(null);
      }
    };
    const onAiQuotaExhausted = () => {
      setAiAvailable(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthValue = {
    user,
    loading,
    aiEnabled: aiAvailable && aiUserOn,
    aiOffByUser: !aiUserOn,
    aiUsage: aiUserOn ? aiUsage : null,
    setAiPreference: async (enabled) => {
      await api("/account/ai", { method: "PUT", body: { enabled } });
      setAiUserOn(enabled);
      // availability and the daily meter change with the switch: ask the server again
      window.dispatchEvent(new Event(AI_USAGE_UPDATED_EVENT));
    },
    login: async (email, password) => {
      const r = await api<Session & { token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSessionToken(r.token);
      setUser(r.user);
      setAiAvailable(!!r.features?.ai);
      setAiUsage(r.features?.aiUsage ?? null);
      void loadAiPreference();
    },
    register: async (input) => {
      await api("/auth/register", { method: "POST", body: input });
    },
    logout: () => {
      clearSessionToken();
      setUser(null);
      setAiAvailable(false);
      setAiUserOn(true);
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