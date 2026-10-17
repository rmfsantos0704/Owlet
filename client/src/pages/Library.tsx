import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { ResearchItem } from "../types";
import ResearchCard from "../components/ResearchCard";

export default function Library() {
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (tag) params.set("tag", tag);
      setLoading(true);
      api<{ items: ResearchItem[] }>(`/research?${params}`)
        .then((r) => { if (!cancelled) { setItems(r.items); setError(""); } })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, tag]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, summary, or tag…"
          className="w-full rounded border bg-white px-3 py-2"
        />
        {tag && (
          <button onClick={() => setTag("")} className="whitespace-nowrap rounded border bg-white px-3 text-sm">
            #{tag} ✕
          </button>
        )}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Nothing here yet. Clip a page with the extension.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => <ResearchCard key={it._id} item={it} onTag={setTag} />)}
        </div>
      )}
    </div>
  );
}