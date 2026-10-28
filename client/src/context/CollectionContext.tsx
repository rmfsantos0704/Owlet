import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import type { Invitation, Collection } from "../types";

type Value = {
  collections: Collection[];
  current: Collection | null;
  ready: boolean;
  invitations: Invitation[];
  select: (id: string) => void;
  reload: () => Promise<Collection[]>;
  create: (name: string) => Promise<void>;
  respondToInvitation: (id: string, accept: boolean) => Promise<void>;
  pinned: string[]; // collection ids pinned to the top of the sidebar
  archived: string[]; // collection ids hidden under "Archived" in the sidebar
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
};

type Prefs = { pinned: string[]; archived: string[] };
const NO_PREFS: Prefs = { pinned: [], archived: [] };

const Ctx = createContext<Value | null>(null);
const KEY = "owlet.collectionId";
const INVITE_POLL_MS = 60 * 1000;

export function CollectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [collections, setcollections] = useState<Collection[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentId, setCurrentId] = useState(localStorage.getItem(KEY) ?? "");
  const [ready, setReady] = useState(false);

  // Pins and archives are personal to this person on this browser; they never change the collection for others.
  const prefsKey = `owlet.collectionPrefs:${user?.email ?? ""}`;
  const [prefs, setPrefs] = useState<Prefs>(NO_PREFS);

  useEffect(() => {
    if (!user) {
      setPrefs(NO_PREFS);
      return;
    }
    try {
      const p = JSON.parse(localStorage.getItem(prefsKey) ?? "null");
      setPrefs({
        pinned: Array.isArray(p?.pinned) ? p.pinned.map(String) : [],
        archived: Array.isArray(p?.archived) ? p.archived.map(String) : [],
      });
    } catch {
      setPrefs(NO_PREFS);
    }
  }, [user, prefsKey]);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(prefsKey, JSON.stringify(next));
    } catch {
      /* private mode: the change lasts until the page is closed */
    }
  };

  const reload = useCallback(async () => {
    const r = await api<{ collections: Collection[] }>("/collections");
    setcollections(r.collections);
    return r.collections;
  }, []);

  const reloadInvitations = useCallback(async () => {
    try {
      const r = await api<{ invitations: Invitation[] }>("/collections/invitations");
      setInvitations(r.invitations);
    } catch {
      /* a failed check just leaves the list as it was */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setcollections([]);
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

  const current = collections.find((w) => w.id === currentId) ?? collections[0] ?? null;

  const value: Value = {
    collections,
    current,
    ready,
    invitations,
    pinned: prefs.pinned,
    archived: prefs.archived,
    togglePin: (id) =>
      savePrefs({
        ...prefs,
        pinned: prefs.pinned.includes(id) ? prefs.pinned.filter((x) => x !== id) : [...prefs.pinned, id],
      }),
    toggleArchive: (id) =>
      savePrefs(
        prefs.archived.includes(id)
          ? { ...prefs, archived: prefs.archived.filter((x) => x !== id) }
          : { pinned: prefs.pinned.filter((x) => x !== id), archived: [...prefs.archived, id] } // archiving also unpins
      ),
    select: (id) => {
      localStorage.setItem(KEY, id);
      setCurrentId(id);
    },
    reload,
create: async (name) => {
      const r = await api<any>("/collections", { method: "POST", body: { name } });
      await reload();
      
      // Support both uppercase/lowercase property names and id/_id fields
      const created = r.Collection || r.collection;
      const newId = created?.id || created?._id;

      if (newId) {
        localStorage.setItem(KEY, newId);
        setCurrentId(newId);
      }
    },
    respondToInvitation: async (id, accept) => {
      const r = await api<{ ok: true; collectionId?: string }>(
        `/collections/invitations/${id}/${accept ? "accept" : "decline"}`,
        { method: "POST" }
      );
      if (accept) {
        await reload();
        if (r.collectionId) {
          localStorage.setItem(KEY, r.collectionId);
          setCurrentId(r.collectionId);
        }
      }
      setInvitations((list) => list.filter((i) => i.id !== id));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollections() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCollections must be used inside CollectionProvider");
  return ctx;
}