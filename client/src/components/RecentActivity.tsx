import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { api } from "../services/api";
import type { ActivityEntry } from "../types";
import ActivityRow from "./ActivityRow";

const REFRESH_MS = 60 * 1000;

// "Recent activity" card for the open Collection. reloadKey changes after the page itself adds something (an import).
export default function RecentActivity({ collectionId, reloadKey = 0 }: { collectionId: string; reloadKey?: number }) {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState("");

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

  return (
    <section className="card mb-8 overflow-hidden" aria-label="Recent activity">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Activity className="size-4 text-blue-600" strokeWidth={1.9} />
        <h2 className="font-semibold text-ink">Recent activity</h2>
      </div>
      {error && rows === null ? (
        <p className="px-5 py-6 text-sm text-red-600">{error}</p>
      ) : rows === null ? (
        <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          Nothing yet. New clips, highlights, comments, and members will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((a) => (
            <li key={a.id}>
              {a.item?.exists ? (
                <Link to={`/item/${a.item.id}`} className="block px-5 py-3 transition hover:bg-slate-50">
                  <ActivityRow a={a} />
                </Link>
              ) : (
                <div className="px-5 py-3">
                  <ActivityRow a={a} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}