import { Link } from "react-router-dom";
import type { ResearchItem } from "../types";

export default function ResearchCard({ item, onTag }: { item: ResearchItem; onTag: (t: string) => void }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <Link to={`/item/${item._id}`} className="font-medium hover:underline">
        {item.source.title || item.source.url}
      </Link>
      <p className="mt-0.5 text-xs text-gray-500">
        {item.source.domain} · {new Date(item.createdAt).toLocaleDateString()}
      </p>
      {item.aiOutput.summary && (
        <p className="mt-2 line-clamp-3 text-sm text-gray-700">{item.aiOutput.summary}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {item.tags.map((t) => (
          <button key={t} onClick={() => onTag(t)} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200">
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}