import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { api } from "../services/api";
import type { ActivityEntry } from "../types";
import ActivityRow from "./ActivityRow";
import Modal from "./Modal";

const REFRESH_MS = 60 * 1000;

// "Recent activity" card for the open Collection. It opens the full list in a modal.
// reloadKey changes after the page itself adds something (an import).
export default function RecentActivity({ collectionId, reloadKey = 0 }: { collectionId: string; reloadKey?: number }) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");

    const load = () =>
      api<{ activity: ActivityEntry[] }>(`/collections/${collectionId}/activity?limit=8`)
        .then((r) => {
          if (!cancelled) {
            setRows(r.activity);
            setError("");
          }
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

  // the line under the card title
  const subtitle =
    error && rows === null
      ? "Couldn't load. Open to see why"
      : rows === null
        ? "Loading…"
        : rows.length === 0
          ? "Nothing yet"
          : `${rows.length} recent update${rows.length === 1 ? "" : "s"} · View`;

  return (
    <>
      <section className="card mb-8" aria-label="Recent activity">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="View recent activity"
          className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition hover:bg-slate-50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Activity className="size-5" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">Recent activity</span>
            <span className="block text-xs text-slate-500">{subtitle}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-slate-300" />
        </button>
      </section>

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