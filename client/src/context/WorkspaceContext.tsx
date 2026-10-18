import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import type { Workspace } from "../types";

type Value = {
  workspaces: Workspace[];
  current: Workspace | null;
  ready: boolean;
  select: (id: string) => void;
  reload: () => Promise<Workspace[]>;
  create: (name: string) => Promise<void>;
};

const Ctx = createContext<Value | null>(null);
const KEY = "owlet.workspaceId";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState(localStorage.getItem(KEY) ?? "");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const r = await api<{ workspaces: Workspace[] }>("/workspaces");
    setWorkspaces(r.workspaces);
    return r.workspaces;
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setReady(true);
      return;
    }

    // Safety timeout: force ready=true after 5s if the server hangs completely
    const safetyTimer = setTimeout(() => setReady(true), 5000);

    reload()
      .catch(() => {})
      .finally(() => {
        clearTimeout(safetyTimer);
        setReady(true);
      });
  }, [user, reload]);

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  const value: Value = {
    workspaces,
    current,
    ready,
    select: (id) => {
      localStorage.setItem(KEY, id);
      setCurrentId(id);
    },
    reload,
    create: async (name) => {
      const r = await api<{ workspace: Workspace }>("/workspaces", { method: "POST", body: { name } });
      await reload();
      localStorage.setItem(KEY, r.workspace.id);
      setCurrentId(r.workspace.id);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaces() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspaces must be used inside WorkspaceProvider");
  return ctx;
}