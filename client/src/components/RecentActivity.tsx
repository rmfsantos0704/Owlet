import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { api } from "../services/api";
import type { ActivityEntry } from "../types";
import ActivityRow from "./ActivityRow";
import Modal from "./Modal";

const REFRESH_MS = 60 * 1000;

// the newest entry the person has seen, remembered per Collection in this browser
const seenKey = (collectionId: string) => `owlet:activity-seen:${collectionId}`;
const readSeen = (collectionId: string) => {
  try {
    return localStorage.getItem(seenKey(collectionId));
  } catch {
    return null;
  }
};
const writeSeen = (collectionId: string, id: string) => {
  try {
    localStorage.setItem(seenKey(collectionId), id);
  } catch {
    /* storage unavailable: the badge just won't persist */
  }
};

// "Recent activity" button for the open Collection, with a count of what's new since it was last opened.
// It opens the full list in a modal. reloadKey changes after the page itself adds something (an import).
export default function RecentActivity({ collectionId, reloadKey = 0 }: { collectionId: string; reloadKey?: number }) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [seenId, setSeenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");

    const load = () =>
      api<{ activity: ActivityEntry[] }>(`/collections/${collectionId}/activity?limit=8`)
        .then((r) => {
          if (cancelled) return;
          // first time in this Collection: start from "everything seen" so old history isn't counted as new
          let seen = readSeen(collectionId);
          if (seen === null && r.activity.length > 0) {
            seen = r.activity[0].id;
            writeSeen(collectionId, seen);
          }
          setSeenId(seen);
          setRows(r.activity);
          setError("");
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load activity");
        });

    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [collectionId, reloadKey]);

  // while the list is open, everything in it counts as seen (including updates that arrive meanwhile)
  useEffect(() => {
    if (!open || !rows || rows.length === 0) return;
    writeSeen(collectionId, rows[0].id);
    setSeenId(rows[0].id);
  }, [open, rows, collectionId]);

  // entries are newest first, so the unread ones are those above the last one seen
  const seenIndex = rows && seenId !== null ? rows.findIndex((a) => a.id === seenId) : -1;
  const unread = !rows || rows.length === 0 || seenId === null ? 0 : seenIndex === -1 ? rows.length : seenIndex;
  const badge = seenIndex === -1 ? `${unread}+` : String(unread); // seen entry scrolled out of the list: "8+"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Recent activity, ${badge} new` : "Recent activity"}
        className="btn-secondary relative"
      >
        <History className="size-4 text-blue-600" strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {badge}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Recent activity" maxWidth="max-w-xl">
        {/* the negative margins let the rows run edge to edge inside the modal */}
        <div className="-mx-6 -my-4">
          {error && rows === null ? (
            <p className="px-6 py-8 text-sm text-red-600">{error}</p>
          ) : rows === null ? (
            <p className="px-6 py-8 text-sm text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400">
              Nothing yet. New clips, highlights, comments, and members will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((a) => (
                <li key={a.id}>
                  {a.item?.exists ? (
                    <Link
                      to={`/item/${a.item.id}`}
                      onClick={() => setOpen(false)}
                      className="block px-6 py-3 transition hover:bg-slate-50"
                    >
                      <ActivityRow a={a} />
                    </Link>
                  ) : (
                    <div className="px-6 py-3">
                      <ActivityRow a={a} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}