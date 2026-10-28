import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MailPlus } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCollections } from "../context/CollectionContext";
import type { ActivityEntry, Invitation } from "../types";
import ActivityRow from "./ActivityRow";

const POLL_MS = 60 * 1000;

const ROLE_TEXT = {
  editor: "an editor (can add and change clips)",
  viewer: "a viewer (can read, search, and export)",
} as const;

const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

// the server sends `collection`; the type says `Collection`, so accept either
const invitedTo = (inv: Invitation) =>
  (inv as any).Collection?.name ?? (inv as any).collection?.name ?? "a Collection";

// Bell for the header: invitations waiting for you, plus what other people did in the collections you belong to.
// Opening it marks activity read (the rows that were new stay highlighted until you close it).
// Invitations stay until you accept or decline them, so they keep counting on the badge.
export default function NotificationsBell() {
  const { user } = useAuth();
  const { select, invitations, respondToInvitation } = useCollections();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const badge = unread + invitations.length;

  const load = useCallback(async () => {
    try {
      const r = await api<{ unread: number; notifications: ActivityEntry[] }>("/collections/notifications");
      setItems(r.notifications);
      setUnread(r.unread);
      return r;
    } catch {
      return null; // a failed check just leaves things as they were
    } finally {
      setLoaded(true);
    }
  }, []);

  // check on sign-in, when the tab regains focus, and once a minute
  useEffect(() => {
    if (!user) return;
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !open) void load();
    }, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [user, load, open]);

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    setError("");
    if (!next) return;
    const r = await load(); // fresh list first, so what's new is highlighted
    if (r && r.unread > 0) {
      setUnread(0); // the activity count clears now; the rows keep their highlight until the panel closes
      api("/collections/notifications/read", { method: "POST" }).catch(() => {});
    }
  }

  function go(a: ActivityEntry) {
    setOpen(false);
    if (a.item?.exists) {
      navigate(`/item/${a.item.id}`);
    } else if (a.Collection) {
      select(a.Collection.id);
      navigate("/");
    }
  }

  async function answer(inv: Invitation, accept: boolean) {
    if (busyId) return;
    setBusyId(inv.id);
    setError("");
    try {
      await respondToInvitation(inv.id, accept);
      if (accept) {
        setOpen(false);
        navigate("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyId("");
    }
  }

  if (!user) return null;

  const empty = invitations.length === 0 && items.length === 0;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={badge ? `Notifications, ${badge} new` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand"
      >
        <Bell className="size-5" strokeWidth={1.8} />
        {badge > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink">Notifications</div>

          <div className="max-h-[28rem] overflow-y-auto">
            {invitations.length > 0 && (
              <section aria-label="Collection invitations" className="border-b border-slate-100">
                <div className="eyebrow px-4 pb-1 pt-3">Invitations</div>
                <ul className="divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="bg-blue-50/60 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-lg bg-white text-blue-600">
                          <MailPlus className="size-4" strokeWidth={1.9} />
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-ink">
                            Join <span className="break-words">“{invitedTo(inv)}”</span>?
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600">
                            <span className="break-all font-medium">{inv.invitedBy}</span> invited you as{" "}
                            {ROLE_TEXT[inv.role]}.
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            You won't be added unless you accept. Expires in {daysLeft(inv.expiresAt)} day
                            {daysLeft(inv.expiresAt) === 1 ? "" : "s"}.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => answer(inv, false)}
                              disabled={!!busyId}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              onClick={() => answer(inv, true)}
                              disabled={!!busyId}
                              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#173b77] disabled:opacity-50"
                            >
                              {busyId === inv.id ? "Working…" : "Accept"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}
              </section>
            )}

            {!loaded && invitations.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : empty ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Nothing new. Invitations, and activity in Collections you share, show up here.
              </p>
            ) : items.length > 0 ? (
              <>
                {invitations.length > 0 && <div className="eyebrow px-4 pb-1 pt-3">Activity</div>}
                <ul className="divide-y divide-slate-100">
                  {items.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => go(a)}
                        className={`block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${a.unread ? "bg-blue-50/60" : ""}`}
                      >
                        <ActivityRow a={a} showCollection />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}