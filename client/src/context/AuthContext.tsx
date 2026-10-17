import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";

type User = { id?: string; email: string };
type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(path: string, email: string, password: string) {
    const r = await api<{ token: string; user: User }>(path, {
      method: "POST",
      body: { email, password },
    });
    localStorage.setItem("token", r.token);
    setUser(r.user);
  }

  const value: AuthValue = {
    user,
    loading,
    login: (e, p) => authenticate("/auth/login", e, p),
    register: (e, p) => authenticate("/auth/register", e, p),
    logout: () => {
      localStorage.removeItem("token");
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}