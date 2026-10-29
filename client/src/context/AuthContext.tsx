import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";

type User = { id?: string; email: string };

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
  login: (email: string, password: string) => Promise<void>;
  // creating an account does NOT log you in: the user must confirm their email first
  register: (input: RegisterInput) => Promise<void>;
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

  const value: AuthValue = {
    user,
    loading,
    login: async (email, password) => {
      const r = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      localStorage.setItem("token", r.token);
      setUser(r.user);
    },
    register: async (input) => {
      await api("/auth/register", { method: "POST", body: input });
    },
    logout: () => {
      localStorage.removeItem("token");
      setUser(null);
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