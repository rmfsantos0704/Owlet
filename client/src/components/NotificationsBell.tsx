import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCollections } from "../context/CollectionContext";
import type { ActivityEntry } from "../types";
import ActivityRow from "./ActivityRow";

const POLL_MS = 60 * 1000;

// Bell for the header: what other people did in the collections you belong to. Opening it marks everything read,
// but the rows that were new stay highlighted until you close it.
export default function NotificationsBell() {
  const { user } = useAuth();
  const { select } = useCollections();
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

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
    if (!next) return;
    const r = await load(); // fresh list first, so what's new is highlighted
    if (r && r.unread > 0) {
      setUnread(0); // the badge clears now; the rows keep their highlight until the panel closes
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

  if (!user) return null;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand"
      >
        <Bell className="size-5" strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-ink">Notifications</div>
          {!loaded ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Nothing new. When someone adds to a Collection you share, it shows up here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
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
          )}
        </div>
      )}
    </div>
  );
}