import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import type { ResearchItem } from "../types";
import CitationBox from "../components/CitationBox";

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<ResearchItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ item: ResearchItem }>(`/research/${id}`)
      .then((r) => setItem(r.item))
      .catch((e) => setError(e.message));
  }, [id]);

  async function remove() {
    if (!confirm("Delete this clip?")) return;
    await api(`/research/${id}`, { method: "DELETE" });
    navigate("/");
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!item) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm underline">← Library</Link>
      <div>
        <h1 className="text-2xl font-semibold">{item.source.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {item.source.author && `${item.source.author} · `}
          <a href={item.source.url} target="_blank" rel="noreferrer" className="underline">
            {item.source.domain}
          </a>
        </p>
      </div>

      <section>
        <h2 className="mb-1 font-semibold">Summary</h2>
        <p className="text-gray-800">{item.aiOutput.summary || "No AI summary for this clip."}</p>
      </section>
      <section>
        <h2 className="mb-1 font-semibold">Key arguments (paraphrased)</h2>
        <p className="text-gray-800">{item.aiOutput.paraphrase || "—"}</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Citations</h2>
        <CitationBox label="APA" text={item.citations.apa ?? ""} />
        <CitationBox label="MLA" text={item.citations.mla ?? ""} />
        <CitationBox label="Chicago" text={item.citations.chicago ?? ""} />
        <p className="text-xs text-gray-500">Auto-generated from page metadata. Verify before submitting.</p>
      </section>

      <details className="rounded border bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Clipped text ({item.content?.wordCount ?? 0} words)
        </summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{item.content?.rawText}</p>
      </details>

      <button onClick={remove} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50">
        Delete clip
      </button>
    </div>
  );
}