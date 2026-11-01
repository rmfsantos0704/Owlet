import { useEffect, useState, type FormEvent } from "react";
import { api } from "../services/api";
import { useDialog } from "../context/DialogContext";

type Action = "rename" | "merge" | "delete";

export default function CollectionTagManager({ collectionId }: { collectionId: string }) {
  const dialog = useDialog();
  const [tags, setTags] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [action, setAction] = useState<Action>("rename");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ tags: string[] }>(`/collections/${collectionId}/tags`)
      .then((response) => {
        if (cancelled) return;
        setTags(response.tags);
        setTag((current) => response.tags.includes(current) ? current : response.tags[0] ?? "");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load tags");
      });
    return () => { cancelled = true; };
  }, [collectionId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!tag || busy) return;
    if (action !== "delete" && (!target.trim() || target.trim().toLowerCase() === tag)) {
      setError("Choose a different destination tag.");
      return;
    }
    if (action === "delete") {
      const confirmed = await dialog.confirm({
        title: `Delete “${tag}” from this collection?`,
        message: "This removes the tag from every clip in this collection.",
        confirmLabel: "Delete tag",
        danger: true,
      });
      if (!confirmed) return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api<{ tags: string[]; updated: number }>(`/collections/${collectionId}/tags`, {
        method: "PUT",
        body: { action, tag, ...(action === "delete" ? {} : { target: target.trim().toLowerCase() }) },
      });
      setTags(response.tags);
      setTag(response.tags[0] ?? "");
      setTarget("");
      setNotice(`${action === "delete" ? "Removed" : action === "merge" ? "Merged" : "Renamed"} on ${response.updated} ${response.updated === 1 ? "clip" : "clips"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the tag");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-ink">Manage tags</h2>
        <p className="mt-1 text-xs text-slate-400">Rename, combine, or remove a tag across this collection's clips.</p>
      </div>
      {!tags.length ? (
        <p className="text-sm text-slate-500">This collection has no tags yet.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">
            Tag
            <select value={tag} onChange={(e) => { setTag(e.target.value); setTarget(""); }} className="field mt-1">
              {tags.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Action
            <select value={action} onChange={(e) => { setAction(e.target.value as Action); setTarget(""); }} className="field mt-1">
              <option value="rename">Rename</option>
              <option value="merge">Merge into another tag</option>
              <option value="delete">Remove from clips</option>
            </select>
          </label>
          {action === "rename" && (
            <label className="text-xs font-medium text-slate-500 sm:col-span-2">
              New tag
              <input value={target} onChange={(e) => setTarget(e.target.value)} maxLength={40} className="field mt-1" required />
            </label>
          )}
          {action === "merge" && (
            <label className="text-xs font-medium text-slate-500 sm:col-span-2">
              Merge into
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="field mt-1" required>
                <option value="">Choose a tag</option>
                {tags.filter((value) => value !== tag).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={busy || (action === "merge" && tags.length < 2)} className="btn-primary">
              {busy ? "Updating…" : action === "delete" ? "Remove tag" : action === "merge" ? "Merge tags" : "Rename tag"}
            </button>
            {notice && <span className="text-xs text-emerald-700">{notice}</span>}
            {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
          </div>
        </form>
      )}
      {!tags.length && error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
