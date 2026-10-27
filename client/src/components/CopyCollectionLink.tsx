import { useState } from "react";
import { Check, Link2, X } from "lucide-react";
import { api } from "../services/api";
import type { JoinLink, Collection, collectionDetail } from "../types";

const usable = (l?: JoinLink | null): l is JoinLink =>
  !!l && !l.expired && (l.maxUses === null || l.uses < l.maxUses);

// One click: copies the Collection's join link, making one first if there isn't a working one.
// A new link is a viewer link that lasts 7 days. The owner can change that in Collection settings.
// Meant for the Collection header, next to the Settings button.
export default function CopyCollectionLink({ Collection }: { Collection: Collection & { _id?: string } }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");

  async function findOrCreate() {
    const collId = Collection.id || Collection._id;
    if (!collId) throw new Error("Collection ID is missing");

    const r = await api<{ Collection?: collectionDetail; collection?: collectionDetail }>(`/collections/${collId}`);
    const detail = r.Collection || r.collection;
    let link = detail?.joinLink;

    if (!usable(link)) {
      const c = await api<{ joinLink: JoinLink }>(`/collections/${collId}/join-link`, {
        method: "POST",
        body: { role: "viewer", expiresInDays: 7, maxUses: null },
      });
      link = c.joinLink;
    }
    if (!link) throw new Error("Could not get or create join link.");
    return { url: `${window.location.origin}/join/${link.token}`, link };
  }

  async function copy() {
    if (busy) return;
    setBusy(true);
    setDone(false);
    setMsg("");
    setFallbackUrl("");

    const pending = findOrCreate();
    pending.catch(() => {}); // handled below; this stops a duplicate unhandled-rejection warning
    try {
      // Safari only allows copying inside the click, so hand it the promise instead of waiting first
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": pending.then((x) => new Blob([x.url], { type: "text/plain" })) }),
        ]);
      } else {
        await navigator.clipboard.writeText((await pending).url);
      }
      const { link } = await pending;
      setDone(true);
      setMsg(`Copied. Joins as ${link.role}, expires ${new Date(link.expiresAt).toLocaleDateString()}.`);
      setTimeout(() => setDone(false), 2000);
      setTimeout(() => setMsg(""), 6000);
    } catch {
      try {
        const { url } = await pending;
        setFallbackUrl(url); // the link exists; the browser just blocked copying
        setMsg("Couldn't copy automatically. Copy the link below.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Couldn't get the link");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={copy} disabled={busy} className="btn-secondary">
        {done ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />}
        {busy ? "Getting link…" : done ? "Link copied" : "Copy join link"}
      </button>
      {(msg || fallbackUrl) && (
        <div className="card absolute right-0 top-full z-30 mt-2 w-72 space-y-2 p-3 text-xs text-slate-600 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="leading-snug">{msg}</p>
            <button type="button" onClick={() => { setMsg(""); setFallbackUrl(""); }} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
              <X className="size-3.5" />
            </button>
          </div>
          {fallbackUrl && (
            <input readOnly value={fallbackUrl} onFocus={(e) => e.currentTarget.select()} className="field !py-1 !text-xs" />
          )}
        </div>
      )}
    </div>
  );
}