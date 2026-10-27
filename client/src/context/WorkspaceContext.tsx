import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import type { Invitation, Workspace } from "../types";

type Value = {
  workspaces: Workspace[];
  current: Workspace | null;
  ready: boolean;
  invitations: Invitation[];
  select: (id: string) => void;
  reload: () => Promise<Workspace[]>;
  create: (name: string) => Promise<void>;
  respondToInvitation: (id: string, accept: boolean) => Promise<void>;
};

const Ctx = createContext<Value | null>(null);
const KEY = "owlet.workspaceId";
const INVITE_POLL_MS = 60 * 1000;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentId, setCurrentId] = useState(localStorage.getItem(KEY) ?? "");
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const r = await api<{ workspaces: Workspace[] }>("/workspaces");
    setWorkspaces(r.workspaces);
    return r.workspaces;
  }, []);

  const reloadInvitations = useCallback(async () => {
    try {
      const r = await api<{ invitations: Invitation[] }>("/workspaces/invitations");
      setInvitations(r.invitations);
    } catch {
      /* a failed check just leaves the list as it was */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setInvitations([]);
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

  // pick up new invitations: on sign-in, when the tab regains focus, and once a minute
  useEffect(() => {
    if (!user) return;
    void reloadInvitations();
    const onFocus = () => void reloadInvitations();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reloadInvitations();
    }, INVITE_POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [user, reloadInvitations]);

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  const value: Value = {
    workspaces,
    current,
    ready,
    invitations,
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
    respondToInvitation: async (id, accept) => {
      const r = await api<{ ok: true; workspaceId?: string }>(
        `/workspaces/invitations/${id}/${accept ? "accept" : "decline"}`,
        { method: "POST" }
      );
      if (accept) {
        await reload();
        if (r.workspaceId) {
          localStorage.setItem(KEY, r.workspaceId);
          setCurrentId(r.workspaceId);
        }
      }
      setInvitations((list) => list.filter((i) => i.id !== id));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaces() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspaces must be used inside WorkspaceProvider");
  return ctx;
}
