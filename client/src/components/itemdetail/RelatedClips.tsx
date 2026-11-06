import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";

type RelatedClip = {
  id: string;
  title: string;
  domain?: string;
  author?: string;
  sharedTags: string[];
};

export default function RelatedClips({ itemId }: { itemId: string }) {
  const [items, setItems] = useState<RelatedClip[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ items: RelatedClip[] }>(`/research/${itemId}/related`)
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Couldn't load related clips");
      });
    return () => { cancelled = true; };
  }, [itemId]);

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!items.length) return null;
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="font-semibold text-ink">Related clips</h2>
        <p className="mt-1 text-xs text-slate-400">From this collection, matched by shared tags and key terms.</p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={`/item/${item.id}`} className="text-sm font-medium text-slate-700 hover:text-blue-700">
              {item.title}
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {[item.domain, item.author].filter(Boolean).join(" · ")}
              {item.sharedTags.length > 0 && ` · ${item.sharedTags.join(", ")}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
