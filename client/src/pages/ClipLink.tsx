import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Link2 } from "lucide-react";
import { useCollections } from "../context/CollectionContext";
import LinkClipper from "../components/library/LinkClipper";

const RETURN_KEY = "owlet.returnTo";

// the shared address can arrive as ?url=..., or inside ?text=... (what phones' share menus send)
function pickUrl(params: URLSearchParams): string {
  const direct = (params.get("url") ?? "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  const hay = [params.get("text"), params.get("title"), direct].filter(Boolean).join(" ");
  return (hay.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? "").replace(/[),.;]+$/, "");
}

// Opened from a share link, a bookmarklet or a phone shortcut: /clip?url=...
// Showing this page saves nothing. The page is saved only when the person presses Save link.
export default function ClipLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { collections, current, select } = useCollections();
  const [picked, setPicked] = useState("");
  const [saved, setSaved] = useState<{ id: string; title: string; aiFailed: boolean } | null>(null);
  const [round, setRound] = useState(0); // changes after a save, so the form starts empty for the next link

  const initialUrl = pickUrl(params);
  const writable = (collections ?? []).filter((c) => c.role !== "viewer");
  const collectionId = picked || writable.find((c) => c.id === current?.id)?.id || writable[0]?.id || "";

  useEffect(() => {
    // the link has been reached, so a login that was waiting for it is done
    try {
      localStorage.removeItem(RETURN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-4 sm:pt-10">
      <div className="card space-y-4 p-5 sm:p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Link2 className="size-5" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Save a link to Owlet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Owlet opens the page, saves its text and builds its citations. Nothing is saved until you press Save link.
          </p>
        </div>

        {saved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <Check className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">
                Saved “{saved.title}”.{saved.aiFailed ? " The AI summary didn't finish. You can regenerate it on the clip." : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/item/${saved.id}`} className="btn-primary">Open the clip</Link>
              <button
                type="button"
                onClick={() => {
                  setSaved(null);
                  setRound((r) => r + 1);
                }}
                className="btn-secondary"
              >
                Save another link
              </button>
              <button
                type="button"
                onClick={() => {
                  if (collectionId) select(collectionId);
                  navigate("/");
                }}
                className="btn-secondary"
              >
                Go to the library
              </button>
            </div>
          </div>
        ) : writable.length === 0 ? (
          <p className="text-sm text-slate-500">You don't have a collection you can add to yet.</p>
        ) : (
          <>
            {writable.length > 1 && (
              <label className="block text-xs font-medium text-slate-500">
                Save to
                <select value={collectionId} onChange={(e) => setPicked(e.target.value)} className="field mt-1">
                  {writable.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            <LinkClipper key={round} collectionId={collectionId} initialUrl={initialUrl} onSaved={setSaved} />
          </>
        )}
      </div>
    </div>
  );
}