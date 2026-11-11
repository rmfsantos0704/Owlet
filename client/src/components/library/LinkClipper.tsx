import { useState, type FormEvent } from "react";
import { Link2, Loader2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import type { ResearchItem } from "../../types";

type Saved = { id: string; title: string; aiFailed: boolean };

type Props = {
  collectionId: string;
  initialUrl?: string;
  onSaved: (saved: Saved) => void;
};

const MIN_TEXT = 50; // same minimum as a clip from the extension

// Saves a web page from its address: Owlet downloads and reads it. When a page can't be read
// (a login wall, a site that blocks readers), the person can paste its text and Owlet saves that instead.
export default function LinkClipper({ collectionId, initialUrl = "", onSaved }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  function reset() {
    setUrl("");
    setTitle("");
    setText("");
    setPaste(false);
    setError("");
  }

  function failed(e: unknown) {
    if (e instanceof ApiError && e.status === 409) {
      setError("That page is already in this collection.");
      return;
    }
    setError(e instanceof Error ? e.message : "Couldn't save that link.");
    // anything that stopped Owlet reading the page: offer to paste the text instead
    if (!(e instanceof ApiError) || e.status !== 429) setPaste(true);
  }

  async function saveLink(e: FormEvent) {
    e.preventDefault();
    const address = url.trim();
    if (!address || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ item: ResearchItem; aiFailed?: boolean }>("/research/clip-url", {
        method: "POST",
        body: { url: address, collectionId },
      });
      onSaved({ id: r.item._id, title: r.item.source.title ?? address, aiFailed: !!r.aiFailed });
      reset();
    } catch (err) {
      failed(err);
    } finally {
      setBusy(false);
    }
  }

  async function savePasted(e: FormEvent) {
    e.preventDefault();
    if (busy || !url.trim() || !title.trim() || text.trim().length < MIN_TEXT) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ item: ResearchItem; aiFailed?: boolean }>("/research/clip", {
        method: "POST",
        body: { url: url.trim(), title: title.trim(), rawText: text.trim(), collectionId },
      });
      onSaved({ id: r.item._id, title: r.item.source.title ?? title.trim(), aiFailed: !!r.aiFailed });
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError("That page is already in this collection.");
      else setError(err instanceof Error ? err.message : "Couldn't save the text.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={saveLink} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 aria-hidden="true" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link to a web page"
            aria-label="Link to save"
            disabled={busy}
            className="field pl-10"
          />
        </div>
        <button type="submit" disabled={busy || !url.trim()} className="btn-primary">
          {busy && !paste ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy && !paste ? "Saving…" : "Save link"}
        </button>
      </form>

      {busy && !paste && <p role="status" className="text-xs text-slate-500">Opening the page and reading it. This can take a few seconds.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!paste ? (
        <button type="button" onClick={() => setPaste(true)} className="text-xs font-semibold text-blue-700 hover:underline">
          Paste the text yourself instead
        </button>
      ) : (
        <form onSubmit={savePasted} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs leading-5 text-slate-500">
            Owlet saves the text you paste, with the link above as its source. Use this for pages that need a login or can't be opened automatically.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            placeholder="Title of the page"
            aria-label="Title"
            disabled={busy}
            className="field"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste the page's text here"
            aria-label="Page text"
            disabled={busy}
            className="field"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              {text.trim().length < MIN_TEXT ? `At least ${MIN_TEXT} characters (${MIN_TEXT - text.trim().length} more)` : "Ready to save"}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaste(false)} disabled={busy} className="btn-secondary">Cancel</button>
              <button
                type="submit"
                disabled={busy || !url.trim() || !title.trim() || text.trim().length < MIN_TEXT}
                className="btn-primary"
              >
                {busy ? "Saving…" : "Save text"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}