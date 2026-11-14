import { useState, type FormEvent } from "react";
import { Link2, Loader2 } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useAiPreference } from "../../hooks/useAiPreference";
import type { ResearchItem } from "../../types";

export type Saved = {
  id: string;
  title: string;
  aiFailed: boolean;
  existed?: boolean; // the page was already in the collection, so only the highlight was added
  // only set when a highlight was shared along with the link
  highlight?: "placed" | "unplaced" | "failed";
};

type Props = {
  collectionId: string;
  initialUrl?: string;
  highlight?: string; // text the person selected on the page before sharing it
  color?: string; // the highlight's color; one of the colors the server accepts
  onSaved: (saved: Saved) => void;
};

const MIN_TEXT = 50; // same minimum as a clip from the extension
const MAX_HIGHLIGHT = 2000; // the server's limit for one highlight

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Curly quotes and long dashes differ between a phone's selection and the saved page text.
// Every replacement is one character for one character, so positions stay the same.
const fold = (value: string) =>
  value
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-");

// the site's name, used as a starting title when the page itself can't be read
function hostOf(address: string): string {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Where the highlighted passage sits in the clip's text (whitespace-insensitive), or null if it isn't there.
function findRange(raw: string, quote: string): { start: number; end: number } | null {
  const words = fold(quote).split(/\s+/).filter(Boolean).map(escapeRegex);
  if (!words.length) return null;
  const match = new RegExp(words.join("\\s+"), "i").exec(fold(raw));
  if (!match) return null;
  const start = match.index;
  let end = start + match[0].length;
  if (end - start > MAX_HIGHLIGHT) {
    // too long for one highlight: keep the start of it, ending on a whole word
    const cut = raw.slice(start, start + MAX_HIGHLIGHT).search(/\s\S*$/);
    end = start + (cut > 0 ? cut : MAX_HIGHLIGHT);
  }
  return { start, end };
}

// the clip's id when this page is already in the collection
async function lookupExisting(address: string, collectionId: string): Promise<string | null> {
  try {
    const r = await api<{ id: string | null }>(
      `/research/lookup?url=${encodeURIComponent(address)}&collectionId=${encodeURIComponent(collectionId)}`,
      { method: "GET" }
    );
    return r.id ?? null;
  } catch {
    return null;
  }
}

// Saves the highlighted text on a clip. It is marked in the reader when its place in the page text is found;
// otherwise it is still saved, just without a position.
async function addHighlightTo(
  id: string,
  quote: string,
  color: string
): Promise<{ title?: string; result: NonNullable<Saved["highlight"]> }> {
  let raw = "";
  let title: string | undefined;
  try {
    const r = await api<{ item: { source?: { title?: string }; content?: { rawText?: string } } }>(
      `/research/${id}`,
      { method: "GET" }
    );
    raw = r.item.content?.rawText ?? "";
    title = r.item.source?.title;
  } catch {
    /* save the highlight without a position below */
  }
  const range = raw ? findRange(raw, quote) : null;
  const body = range
    ? { text: raw.slice(range.start, range.end), startOffset: range.start, endOffset: range.end, color }
    : { text: quote.slice(0, MAX_HIGHLIGHT), color };
  try {
    await api<unknown>(`/research/${id}/highlights`, { method: "POST", body });
    return { title, result: range ? "placed" : "unplaced" };
  } catch {
    return { title, result: "failed" };
  }
}

// Saves a web page from its address: Owlet downloads and reads it. When a page can't be read
// (a login wall, a site that blocks readers), the person can paste its text and Owlet saves that instead.
// If text was highlighted before sharing, it is saved as a highlight on the clip, and when the page can't be
// read the highlighted text itself is offered as the clip's text.
// When AI is available, a checkbox lets the person save the page without an AI summary (remembered on this device).
export default function LinkClipper({
  collectionId,
  initialUrl = "",
  highlight = "",
  color = "yellow",
  onSaved,
}: Props) {
  const { aiEnabled } = useAuth();
  const [useAi, setUseAi] = useAiPreference();
  const aiOff = aiEnabled && !useAi; // only then is useAi: false sent; otherwise the server decides as before

  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  const quote = highlight.trim();

  function reset() {
    setUrl("");
    setTitle("");
    setText("");
    setPaste(false);
    setError("");
  }

  // opens the paste form; with a shared highlight, its text and the site's name are filled in
  function openPaste() {
    setPaste(true);
    if (quote) {
      setText((t) => t || quote);
      setTitle((t) => t || hostOf(url));
    }
  }

  function failed(e: unknown) {
    if (e instanceof ApiError && e.status === 409) {
      setError("That page is already in this collection.");
      return;
    }
    setError(e instanceof Error ? e.message : "Couldn't save that link.");
    // anything that stopped Owlet reading the page: offer to paste the text instead
    if (!(e instanceof ApiError) || e.status !== 429) openPaste();
  }

  // adds the highlight (if there is one) to the saved clip and reports back
  async function finish(id: string, clipTitle: string, aiFailed: boolean, existed: boolean) {
    if (!quote) {
      onSaved({ id, title: clipTitle, aiFailed, existed });
      return;
    }
    const h = await addHighlightTo(id, quote, color);
    onSaved({ id, title: h.title ?? clipTitle, aiFailed, existed, highlight: h.result });
  }

  async function saveLink(e: FormEvent) {
    e.preventDefault();
    const address = url.trim();
    if (!address || busy) return;
    setBusy(true);
    setError("");
    try {
      // a highlight on a page that is already saved only needs the highlight added: skip downloading it again
      let id = quote ? await lookupExisting(address, collectionId) : null;
      let existed = Boolean(id);
      let clipTitle = address;
      let aiFailed = false;

      if (!id) {
        try {
          const r = await api<{ item: ResearchItem; aiFailed?: boolean }>("/research/clip-url", {
            method: "POST",
            body: { url: address, collectionId, ...(aiOff ? { useAi: false } : {}) },
          });
          id = r.item._id;
          clipTitle = r.item.source.title ?? address;
          aiFailed = !!r.aiFailed;
        } catch (err) {
          // saved a moment ago (or the lookup missed it): the highlight can still go on that clip
          if (quote && err instanceof ApiError && err.status === 409) {
            id = await lookupExisting(address, collectionId);
            existed = true;
          }
          if (!id) throw err;
        }
      }
      if (!id) throw new Error("Couldn't save that link.");

      await finish(id, clipTitle, aiFailed, existed);
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
      let id: string | null = null;
      let existed = false;
      let clipTitle = title.trim();
      let aiFailed = false;
      try {
        const r = await api<{ item: ResearchItem; aiFailed?: boolean }>("/research/clip", {
          method: "POST",
          body: {
            url: url.trim(),
            title: title.trim(),
            rawText: text.trim(),
            collectionId,
            ...(aiOff ? { useAi: false } : {}),
          },
        });
        id = r.item._id;
        clipTitle = r.item.source.title ?? clipTitle;
        aiFailed = !!r.aiFailed;
      } catch (err) {
        if (quote && err instanceof ApiError && err.status === 409) {
          id = await lookupExisting(url.trim(), collectionId);
          existed = true;
        }
        if (!id) throw err;
      }
      if (!id) throw new Error("Couldn't save the text.");

      await finish(id, clipTitle, aiFailed, existed);
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

      {aiEnabled && (
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            disabled={busy}
            className="size-3.5 accent-blue-600"
          />
          Generate an AI summary and tags
        </label>
      )}

      {busy && !paste && <p role="status" className="text-xs text-slate-500">Opening the page and reading it. This can take a few seconds.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!paste ? (
        <button type="button" onClick={openPaste} className="text-xs font-semibold text-blue-700 hover:underline">
          {quote ? "Save my highlighted text without reading the page" : "Paste the text yourself instead"}
        </button>
      ) : (
        <form onSubmit={savePasted} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs leading-5 text-slate-500">
            {quote
              ? "Your highlighted text is filled in below, so it can be saved even though Owlet can't read the whole page. The link above stays as its source. Paste more of the page's text here if you want to keep it all."
              : "Owlet saves the text you paste, with the link above as its source. Use this for pages that need a login or can't be opened automatically."}
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