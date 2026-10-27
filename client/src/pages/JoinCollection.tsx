import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { api } from "../services/api";
import { useCollections } from "../context/CollectionContext";
import type { JoinPreview } from "../types";

const ROLE_TEXT = {
  editor: "an editor (can add and change clips)",
  viewer: "a viewer (can read, search, and export)",
} as const;

// Opened from a join link. Showing this page changes nothing: the person is added only when they press Join.
export default function JoinCollection() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { reload, select } = useCollections();
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem("owlet.returnTo"); // the link has been reached; stop remembering it
    } catch {
      /* ignore */
    }
    api<JoinPreview>(`/collections/join/${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch((e) => setError(e instanceof Error ? e.message : "This link isn't valid anymore."));
  }, [token]);

  async function open(collectionId: string) {
    await reload();
    select(collectionId);
    navigate("/");
  }

  async function join() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ ok: true; collectionId: string }>(`/collections/join/${encodeURIComponent(token)}`, {
        method: "POST",
      });
      await open(r.collectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <div className="mx-auto max-w-md pt-10">
        {error ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Link to="/" className="btn-secondary inline-flex">Back to Owlet</Link>
          </div>
        ) : (
          <p className="text-center text-slate-400">Checking the link…</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <div className="card space-y-4 p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Users className="size-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Join <span className="break-words">“{preview.Collection?.name ?? "Collection"}”</span>?
          </h1>
          {preview.Collection?.description && (
            <p className="mt-1 text-sm text-slate-500">{preview.Collection.description}</p>
          )}
        </div>
        {preview.alreadyMember ? (
          <p className="text-sm text-slate-600">You're already a member of this Collection.</p>
        ) : (
          <p className="text-sm text-slate-600">
            This Collection belongs to <span className="break-all font-medium">{preview.ownerEmail}</span>. You'd join as{" "}
            {ROLE_TEXT[preview.role]}.
          </p>
        )}
        <p className="text-xs text-slate-400">
          {preview.alreadyMember
            ? "Nothing to confirm."
            : "You won't be added unless you press Join. Only join collections you recognize."}
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Link to="/" className="btn-secondary">Not now</Link>
          {preview.alreadyMember ? (
            <button onClick={() => open(preview.collectionId)} className="btn-primary">Open Collection</button>
          ) : (
            <button onClick={join} disabled={busy} className="btn-primary">
              {busy ? "Joining…" : "Join Collection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}