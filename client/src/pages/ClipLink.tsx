import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, Highlighter, Library, Link2, Plus } from "lucide-react";
import { useCollections } from "../context/CollectionContext";
import { api } from "../services/api";
import LinkClipper, { type Saved } from "../components/library/LinkClipper";
import { COLOR_STYLES, HIGHLIGHT_COLORS, styleFor, type HighlightColor } from "../utils/colors";

const RETURN_KEY = "owlet.returnTo";
const COLOR_KEY = "owlet.shareHighlightColor";
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const MAX_HIGHLIGHT = 2000; // the server's limit for one highlight

type SavedHighlight = { _id: string; text: string; color?: string; note?: string; startOffset?: number };
type Existing = { id: string; highlights: SavedHighlight[] };

// the color used for the last shared highlight on this device
function loadColor(): HighlightColor {
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    if (saved && (HIGHLIGHT_COLORS as readonly string[]).includes(saved)) return saved as HighlightColor;
  } catch {
    /* ignore */
  }
  return "yellow";
}

// the shared address can arrive as ?url=..., or inside ?text=... (what phones' share menus send)
function pickUrl(params: URLSearchParams): string {
  const direct = (params.get("url") ?? "").trim();
  const hay = /^https?:\/\//i.test(direct)
    ? direct
    : [params.get("text"), params.get("title"), direct].filter(Boolean).join(" ");
  const found = (hay.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? "").replace(/[),.;]+$/, "");
  // Chrome adds #:~:text=... when you share a selection. Drop it so the same page always
  // has one address (otherwise every shared highlight would look like a different page).
  return found.replace(/#:~:text=.*$/i, "");
}

// the highlighted passage is whatever is left of ?text= once the address is taken out
function pickHighlight(params: URLSearchParams): string {
  const title = (params.get("title") ?? "").trim();
  const text = (params.get("text") ?? "")
    .replace(URL_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim();
  // some apps send "page title + link" when nothing was selected: that is not a highlight
  if (!text || text === title) return "";
  return text.slice(0, MAX_HIGHLIGHT);
}

function savedMessage(s: Saved): string {
  const clip = `“${s.title}”`;
  switch (s.highlight) {
    case "placed":
      return s.existed
        ? `Added your highlight to ${clip}, which was already in this collection.`
        : `Saved ${clip} with your highlight.`;
    case "unplaced":
      return `${s.existed ? "Added your highlight to" : "Saved"} ${clip}, but Owlet couldn't find the highlighted text in the page, so it isn't marked in the reader.`;
    case "failed":
      return s.existed
        ? `Couldn't add your highlight to ${clip}. Open the clip to add it again.`
        : `Saved ${clip}, but your highlight didn't save. Open the clip to add it again.`;
    default:
      return `Saved ${clip}.`;
  }
}

// Opened from a share link, a bookmarklet or a phone shortcut: /clip?url=...
// Showing this page saves nothing. The page is saved only when the person presses Save link.
export default function ClipLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { collections, current, select } = useCollections();
  const [picked, setPicked] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [round, setRound] = useState(0); // changes after a save, so the form starts empty for the next link
  const [sharedHighlight] = useState(() => pickHighlight(params));
  const [highlight, setHighlight] = useState(sharedHighlight);
  const [color, setColor] = useState<HighlightColor>(loadColor);
  const [existing, setExisting] = useState<Existing | null>(null); // this page's clip, if it is already saved
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false); // the saved-highlights dropdown

  const initialUrl = pickUrl(params);
  const writable = (collections ?? []).filter((c) => c.role !== "viewer");
  const collectionId = picked || writable.find((c) => c.id === current?.id)?.id || writable[0]?.id || "";
  const showHighlight = Boolean(sharedHighlight) && round === 0;
  const chosen = styleFor(color);

  useEffect(() => {
    // the link has been reached, so a login that was waiting for it is done
    try {
      localStorage.removeItem(RETURN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // is this page already saved in the chosen collection? if so, load the highlights it has
  useEffect(() => {
    setExisting(null);
    setOpen(false);
    if (!initialUrl || !collectionId) return;
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const found = await api<{ id: string | null }>(
          `/research/lookup?url=${encodeURIComponent(initialUrl)}&collectionId=${encodeURIComponent(collectionId)}`,
          { method: "GET" }
        );
        if (!found.id) return;
        const r = await api<{ highlights: SavedHighlight[] }>(`/research/${found.id}/highlights`, { method: "GET" });
        if (!cancelled) setExisting({ id: found.id, highlights: r.highlights ?? [] });
      } catch {
        /* the panel just doesn't show */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialUrl, collectionId]);

  function chooseColor(next: HighlightColor) {
    setColor(next);
    try {
      localStorage.setItem(COLOR_KEY, next); // remembered for the next share
    } catch {
      /* ignore */
    }
  }

  // in the order they appear on the page (highlights without a position keep their saved order, at the end)
  const sortedHighlights = existing
    ? [...existing.highlights].sort(
        (a, b) => (a.startOffset ?? Number.MAX_SAFE_INTEGER) - (b.startOffset ?? Number.MAX_SAFE_INTEGER)
      )
    : [];
  const count = sortedHighlights.length;
  const showPanel = Boolean(existing) && round === 0;
  // a page that is already saved, shared with no new highlight, has nothing left to save
  const hideForm = showPanel && !sharedHighlight;

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-4 sm:pt-10">
      <div className="card space-y-4 p-5 sm:p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {showHighlight ? (
            <Highlighter className="size-5" strokeWidth={1.9} />
          ) : (
            <Link2 className="size-5" strokeWidth={1.9} />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {showHighlight ? "Save a highlight to Owlet" : "Save a link to Owlet"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {showHighlight
              ? "Owlet saves the page, builds its citations and keeps your highlighted text on it. Nothing is saved until you press Save link."
              : "Owlet opens the page, saves its text and builds its citations. Nothing is saved until you press Save link."}
          </p>
        </div>

        {saved ? (
          <div className="space-y-4">
            <div
              className={`flex items-start gap-3 rounded-xl p-3 text-sm ${
                saved.highlight === "failed" || saved.highlight === "unplaced"
                  ? "bg-amber-50 text-amber-900"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              <Check className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {savedMessage(saved)}
                {saved.aiFailed ? " The AI summary didn't finish. You can regenerate it on the clip." : ""}
              </span>
            </div>
            <div className="flex items-stretch gap-2">
              <Link
                to={`/item/${saved.id}`}
                className="btn-primary flex-1 !flex-col gap-1 !px-1.5 !py-2 text-center text-xs leading-tight sm:!flex-row sm:gap-2 sm:text-sm"
              >
                <BookOpen className="size-5 shrink-0" strokeWidth={1.9} />
                Open the clip
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSaved(null);
                  setHighlight("");
                  setRound((r) => r + 1);
                }}
                className="btn-secondary flex-1 !flex-col gap-1 !px-1.5 !py-2 text-center text-xs leading-tight sm:!flex-row sm:gap-2 sm:text-sm"
              >
                <Plus className="size-5 shrink-0" strokeWidth={1.9} />
                Save another link
              </button>
              <button
                type="button"
                onClick={() => {
                  if (collectionId) select(collectionId);
                  navigate("/");
                }}
                className="btn-secondary flex-1 !flex-col gap-1 !px-1.5 !py-2 text-center text-xs leading-tight sm:!flex-row sm:gap-2 sm:text-sm"
              >
                <Library className="size-5 shrink-0" strokeWidth={1.9} />
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

            {checking && !existing && round === 0 && (
              <p role="status" className="text-xs text-slate-400">Checking for highlights saved on this page…</p>
            )}

            {showPanel && existing && (
              <section aria-label="Highlights saved on this page" className="rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 p-2.5">
                  {count > 0 ? (
                    <button
                      type="button"
                      onClick={() => setOpen((v) => !v)}
                      aria-expanded={open}
                      aria-controls="saved-highlights"
                      aria-label={`Already saved, ${count} highlight${count === 1 ? "" : "s"}`}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1 text-left text-sm font-semibold text-ink"
                    >
                      <span className="shrink-0 whitespace-nowrap">Already saved</span>
                      <span className="flex shrink-0 items-center gap-1 text-slate-600">
                        · {count}
                        <Highlighter className="size-4" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`ml-auto size-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                    <p
                      aria-label="Already saved, no highlights yet"
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-sm font-semibold text-ink"
                    >
                      <span className="shrink-0 whitespace-nowrap">Already saved</span>
                      <span className="flex shrink-0 items-center gap-1 text-slate-600">
                        · 0
                        <Highlighter className="size-4" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                    </p>
                  )}
                  <Link
                    to={`/item/${existing.id}`}
                    aria-label="Open the clip"
                    title="Open the clip"
                    className="btn-secondary shrink-0 gap-1.5 max-sm:size-10 max-sm:!p-0"
                  >
                    <BookOpen className="size-4" strokeWidth={1.9} />
                    <span className="hidden sm:inline">Open the clip</span>
                  </Link>
                </div>

                {open && count > 0 && (
                  <ul id="saved-highlights" className="max-h-64 space-y-2 overflow-y-auto border-t border-slate-200 p-2.5">
                    {sortedHighlights.map((h) => (
                      <li
                        key={h._id}
                        className={`rounded-lg border-l-4 px-3 py-2 text-sm text-ink ${styleFor(h.color).quote}`}
                      >
                        <p className="whitespace-pre-line break-words">{h.text}</p>
                        {h.note && <p className="mt-1 text-xs italic text-slate-500">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}

                {hideForm && (
                  <p className="border-t border-slate-200 px-3.5 py-2 text-xs text-slate-400">
                    To add another highlight, select text on the page and share it to Owlet.
                  </p>
                )}
              </section>
            )}

            {showHighlight && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-500">
                  Highlighted text
                  <textarea
                    value={highlight}
                    onChange={(e) => setHighlight(e.target.value)}
                    rows={5}
                    maxLength={MAX_HIGHLIGHT}
                    className={`field mt-1 resize-y border-l-4 ${chosen.bar}`}
                  />
                  <span className="mt-1 block text-slate-400">Edit it, or clear it to save only the link.</span>
                </label>

                <div role="radiogroup" aria-label="Highlight color" className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">
                    Color: <span className="text-slate-700">{chosen.label}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {HIGHLIGHT_COLORS.map((name) => {
                      const style = COLOR_STYLES[name];
                      const active = name === color;
                      return (
                        <button
                          key={name}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={style.label}
                          title={style.label}
                          onClick={() => chooseColor(name)}
                          className={`flex size-8 items-center justify-center rounded-full border transition ${style.dot} ${
                            active ? "border-slate-700 ring-2 ring-slate-300" : "border-black/10 hover:scale-110"
                          }`}
                        >
                          {active && <Check className="size-4 text-slate-900" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!hideForm && (
              <LinkClipper
                key={round}
                collectionId={collectionId}
                initialUrl={initialUrl}
                highlight={highlight.trim()}
                color={color}
                onSaved={setSaved}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}