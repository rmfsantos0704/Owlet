import {
  useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type MouseEvent as ReactMouseEvent,
} from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { ChevronDown, ChevronUp, ListPlus, Minus, Plus, Search, Sparkles, StickyNote, X } from "lucide-react";
import ColorPicker from "../shared/ColorPicker";
import DraggableModal from "../shared/DraggableModal";
import { styleFor } from "../../utils/colors";
import LoadingScreen from "../shared/LoadingScreen";
import type { Highlight } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// zoom is a multiplier on "fit to width", so 100% means the page fills the width
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 1000) / 1000));
const MENU_ITEM = "block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-slate-100";

// where the person stopped reading, kept per clip in this browser
const saveKey = (k?: string) => (k ? `owlet:pdf:${k}` : null);
function readSaved(k?: string): { page?: number; zoom?: number } {
  const key = saveKey(k);
  if (!key) return {};
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    const page = Number(v?.page);
    const zoom = Number(v?.zoom);
    return {
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : undefined,
      zoom: Number.isFinite(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX ? zoom : undefined,
    };
  } catch {
    return {};
  }
}

type Rect = { x: number; y: number; w: number; h: number }; // fractions (0-1) of the page's width and height

export type NewPdfHighlight = {
  text: string;
  color: string;
  note?: string;
  page: number;
  rects: Rect[];
  startOffset?: number;
  endOffset?: number;
};

export type BoardQuestion = { id: string; kind: string; text: string };
export type BoardStance = "supports" | "challenges" | "background" | "methodology" | "open";
const STANCE_LABEL: Record<BoardStance, string> = {
  supports: "Supports",
  challenges: "Challenges",
  background: "Background",
  methodology: "Methodology",
  open: "Open question",
};

type Props = {
  url: string;
  rawText: string;
  pageOffsets: number[];
  highlights: Highlight[];
  canEdit: boolean;
  /** Should throw on failure so the panel keeps what was typed. */
  onCreate: (highlight: NewPdfHighlight) => Promise<unknown> | void;
  /** Scrolls to a page. Pass a new `nonce` each time, so asking for the same page again works. */
  jumpTo?: { page: number; nonce: number };
  /** Identifies the clip, so the page and zoom can be remembered for it. */
  storageKey?: string;
  /** The highlight to emphasise on the page (the one being edited or just chosen in the list). */
  activeId?: string | null;
  /** A highlight was clicked on the page. `at` is where, in screen coordinates, for placing a popover. */
  onHighlightClick?: (id: string, at: { x: number; y: number }) => void;
  /** AI help on the selected text. Leave it out to hide the buttons (for example when AI is off). Should throw on failure. */
  onAsk?: (text: string, mode: "explain" | "summarize") => Promise<string>;
  /** The collection's research questions. Together with `onCreateForQuestion` they let a selection be filed as evidence. */
  questions?: BoardQuestion[];
  /**
   * Saves the highlight, then files it on the evidence board. Throws only if the highlight itself couldn't be saved;
   * resolves to whether it also reached the board.
   */
  onCreateForQuestion?: (
    highlight: NewPdfHighlight,
    target: { questionId: string | null; stance: BoardStance }
  ) => Promise<boolean>;
};

// ---------- text helpers ----------

// spaces and hyphens are ignored when matching, because the PDF's text layer and Owlet's extracted text
// break lines and words differently
const IGNORED = /^[\s\u00ad\u2010\u2011-]$/;
const squash = (s: string) => [...s.normalize("NFKC").toLowerCase()].filter((c) => !IGNORED.test(c)).join("");
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);
const round = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;

function buildIndex(root: HTMLElement) {
  let hay = "";
  const map: { node: Text; offset: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    for (let i = 0; i < n.data.length; i++) {
      for (const ch of n.data[i].normalize("NFKC").toLowerCase()) {
        if (IGNORED.test(ch)) continue;
        hay += ch;
        map.push({ node: n, offset: i });
      }
    }
  }
  return { hay, map };
}

function pushRects(out: Rect[], range: Range, page: DOMRect) {
  for (const c of Array.from(range.getClientRects())) {
    if (c.width < 1 || c.height < 1) continue;
    out.push({
      x: round((c.left - page.left) / page.width),
      y: round((c.top - page.top) / page.height),
      w: round(c.width / page.width),
      h: round(c.height / page.height),
    });
  }
}

// joins the small pieces on one line into a single bar
function mergeRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Rect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(r.y - last.y) < last.h * 0.5 && r.x - (last.x + last.w) < 0.02) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      const bottom = Math.max(last.y + last.h, r.y + r.h);
      last.x = Math.min(last.x, r.x);
      last.y = Math.min(last.y, r.y);
      last.w = round(right - last.x);
      last.h = round(bottom - last.y);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

// the on-page rectangles for characters [at, end) of a text layer's index
function rectsFor(map: { node: Text; offset: number }[], at: number, end: number, pageRect: DOMRect): Rect[] {
  const rects: Rect[] = [];
  let i = at;
  while (i < end) {
    const node = map[i].node;
    const start = map[i].offset;
    let last = start;
    let j = i;
    while (j < end && map[j].node === node) {
      last = map[j].offset;
      j++;
    }
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, last + 1);
    pushRects(rects, range, pageRect);
    i = j;
  }
  return mergeRects(rects);
}

// finds a highlight's wording in a page's text layer and returns where it sits (best effort)
function locate(root: HTMLElement, text: string, pageRect: DOMRect): Rect[] {
  const needle = squash(text);
  if (needle.length < 3) return [];
  const { hay, map } = buildIndex(root);
  const at = hay.indexOf(needle);
  if (at < 0) return [];
  return rectsFor(map, at, at + needle.length, pageRect);
}

const MAX_MATCHES = 2000; // across the whole document
const MAX_MATCHES_PER_PAGE = 500;

// every occurrence of the (already squashed) search text in a page's text layer, one Rect[] per match
function locateAll(root: HTMLElement, needle: string, pageRect: DOMRect): Rect[][] {
  if (!needle) return [];
  const { hay, map } = buildIndex(root);
  const out: Rect[][] = [];
  let at = hay.indexOf(needle);
  while (at >= 0 && out.length < MAX_MATCHES_PER_PAGE) {
    out.push(rectsFor(map, at, at + needle.length, pageRect));
    at = hay.indexOf(needle, at + needle.length);
  }
  return out;
}

function selectionRects(range: Range, root: HTMLElement, pageRect: DOMRect): Rect[] {
  const rects: Rect[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!range.intersectsNode(n)) continue;
    const part = document.createRange();
    part.setStart(n, n === range.startContainer ? range.startOffset : 0);
    part.setEnd(n, n === range.endContainer ? range.endOffset : n.data.length);
    pushRects(rects, part, pageRect);
  }
  return mergeRects(rects);
}

// Where the selection sits in Owlet's extracted text, when that can be told for certain.
// Without offsets the highlight still saves; the text view then finds it by its wording.
function findOffsets(rawText: string, pageOffsets: number[], page: number, text: string) {
  const base = pageOffsets[page - 1];
  if (base === undefined) return undefined;
  const slice = rawText.slice(base, pageOffsets[page] ?? rawText.length);
  const words = text.trim().split(/\s+/).map(escapeRx);
  if (!words.length || !words[0]) return undefined;
  const rx = new RegExp(words.join("\\s+"), "g");
  const first = rx.exec(slice);
  if (!first) return undefined;
  rx.lastIndex = first.index + 1;
  if (rx.exec(slice)) return undefined; // the same wording appears twice on the page: don't guess
  return { startOffset: base + first.index, endOffset: base + first.index + first[0].length };
}

// ---------- one page ----------

const NONE: Highlight[] = [];

function PageView({
  doc, n, scale, base, root, highlights, needle, current, focusNonce, activeId, onHighlightClick,
}: {
  doc: PDFDocumentProxy;
  n: number;
  scale: number;
  base: { w: number; h: number };
  root: HTMLElement | null;
  highlights: Highlight[];
  /** the squashed search text, or "" when not searching */
  needle: string;
  /** which match on this page is the current one (-1 when it's on another page) */
  current: number;
  /** changes whenever the viewer wants the current match brought into view */
  focusNonce: number;
  activeId?: string | null;
  onHighlightClick?: (id: string, at: { x: number; y: number }) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textBox = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<{ scale: number; w: number; h: number } | null>(null);
  const [located, setLocated] = useState<Record<string, Rect[]>>({});

  // only pages near the screen are drawn; the rest are empty placeholders of the right size
  useEffect(() => {
    const el = wrap.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { root, rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!active) return;
    const cv = canvas.current;
    const box = textBox.current;
    if (!cv || !box) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let layer: InstanceType<typeof pdfjs.TextLayer> | undefined;

    (async () => {
      const page = await doc.getPage(n);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      cv.width = Math.floor(viewport.width * ratio);
      cv.height = Math.floor(viewport.height * ratio);
      cv.style.width = `${viewport.width}px`;
      cv.style.height = `${viewport.height}px`;
      setSize({ scale, w: viewport.width, h: viewport.height });
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      task = page.render({
        canvas: cv,
        canvasContext: ctx,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await task.promise;
      if (cancelled) return;
      box.replaceChildren();
      layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: box, viewport });
      await layer.render();
      if (!cancelled) setReady(true);
    })().catch(() => {
      /* a render that was cancelled by scrolling away or zooming rejects; that's expected */
    });

    return () => {
      cancelled = true;
      task?.cancel();
      layer?.cancel();
      setReady(false);
      cv.width = 0; // frees the page's memory while it's off screen
      cv.height = 0;
      box.replaceChildren();
    };
  }, [active, doc, n, scale]);

  // highlights without saved positions (older ones) are found by their wording once the text is on screen
  useEffect(() => {
    if (!ready) return;
    const box = textBox.current;
    const page = wrap.current;
    if (!box || !page) return;
    const pageRect = page.getBoundingClientRect();
    const next: Record<string, Rect[]> = {};
    for (const h of highlights) if (!h.rects?.length) next[h._id] = locate(box, h.text, pageRect);
    setLocated(next);
  }, [ready, highlights, scale]);

  // search matches on this page, found in the text layer once it is on screen
  const [found, setFound] = useState<Rect[][]>([]);
  useEffect(() => {
    if (!needle) {
      setFound([]);
      return;
    }
    if (!ready) return;
    const box = textBox.current;
    const page = wrap.current;
    if (!box || !page) return;
    setFound(locateAll(box, needle, page.getBoundingClientRect()));
  }, [ready, needle, scale]);

  // brings the current match to the middle of the screen, once per request (so zooming doesn't re-scroll)
  const handled = useRef(0);
  useEffect(() => {
    if (current < 0 || !found[current]?.length || handled.current === focusNonce) return;
    handled.current = focusNonce;
    wrap.current?.querySelector("[data-search-current]")?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [found, current, focusNonce]);

  const w = size?.scale === scale ? size.w : base.w * scale;
  const h = size?.scale === scale ? size.h : base.h * scale;

  // The highlight layer ignores the pointer (so text can still be selected through it), so a click is matched
  // against the highlights' rectangles here. A click that ends a text selection is not a click on a highlight.
  function onPageClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!onHighlightClick || !wrap.current) return;
    if (!window.getSelection()?.isCollapsed) return;
    const box = wrap.current.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    for (let i = highlights.length - 1; i >= 0; i--) {
      const hl = highlights[i];
      const rects = hl.rects?.length ? hl.rects : located[hl._id] ?? [];
      if (rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) {
        onHighlightClick(hl._id, { x: e.clientX, y: e.clientY });
        return;
      }
    }
  }

  return (
    <div className="mb-4">
      <div
        ref={wrap}
        data-pdf-page={n}
        onClick={onPageClick}
        className="relative mx-auto shadow-md"
        // inline white: your dark theme turns every bg-white navy, but a PDF page is always paper-white
        style={{ width: w, height: h, backgroundColor: "#fff", "--scale-factor": scale, "--total-scale-factor": scale } as CSSProperties}
      >
        <canvas ref={canvas} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          {highlights.flatMap((hl) =>
            (hl.rects?.length ? hl.rects : located[hl._id] ?? []).map((r, i) => (
              <div
                key={`${hl._id}-${i}`}
                title={hl.note || undefined}
                className={`absolute rounded-sm mix-blend-multiply ${styleFor(hl.color).dot} ${
                  hl._id === activeId ? "opacity-70 ring-2 ring-blue-500" : "opacity-40"
                }`}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              />
            ))
          )}
          {found.flatMap((rs, mi) =>
            rs.map((r, i) => (
              <div
                key={`find-${mi}-${i}`}
                data-search-current={mi === current && i === 0 ? "" : undefined}
                className={`absolute rounded-sm ${mi === current ? "bg-orange-400/70 ring-1 ring-orange-600" : "bg-sky-400/40"}`}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              />
            ))
          )}
        </div>
        <div ref={textBox} className="textLayer absolute inset-0" />
      </div>
      <div className="mt-1 text-center text-[11px] text-slate-400">Page {n}</div>
    </div>
  );
}

// ---------- the viewer ----------

type Pending = { text: string; page: number; rects: Rect[] };

export default function PdfViewer({
  url, rawText, pageOffsets, highlights, canEdit, onCreate, jumpTo, storageKey, activeId, onHighlightClick,
  onAsk, questions, onCreateForQuestion,
}: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(() => readSaved(storageKey).zoom ?? 1);
  const [pageInput, setPageInput] = useState("1");
  const [fitReady, setFitReady] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null); // wraps the pages, so a pinch can scale them smoothly
  const fitRef = useRef(1);
  const didFit = useRef(false);
  const restored = useRef(false);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const [pending, setPending] = useState<Pending | null>(null);
  const [color, setColor] = useState("yellow");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [ai, setAi] = useState<{ mode: "explain" | "summarize"; status: "loading" | "done" | "error"; text: string; quote: string } | null>(null);
  const aiRequest = useRef(0); // lets an answer that arrives after the selection changed be ignored
  const [filing, setFiling] = useState(false); // the "Add to question" fields are open beside its button
  const [noteOpen, setNoteOpen] = useState(false); // the note field is open in the selection bar
  const [fileQuestion, setFileQuestion] = useState(""); // "" = not tied to a question
  const [fileStance, setFileStance] = useState<BoardStance>("supports");

  // the "added" confirmation fades on its own
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const frame = useRef(0);

  // ---------- search ----------
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [texts, setTexts] = useState<string[] | null>(null); // every page's text, squashed
  const [cur, setCur] = useState(0); // index into `matches`
  const [focusNonce, setFocusNonce] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const needle = useDeferredValue(squash(query));

  // read every page's text once, the first time search is opened (pages that aren't drawn have no text layer)
  useEffect(() => {
    if (!searchOpen || texts || !doc) return;
    let cancelled = false;
    (async () => {
      const out: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        try {
          const content = await (await doc.getPage(p)).getTextContent();
          out.push(squash(content.items.map((it) => ("str" in it ? it.str : "")).join("")));
        } catch {
          out.push("");
        }
        if (cancelled) return;
      }
      setTexts(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchOpen, texts, doc]);

  const matches = useMemo(() => {
    const out: { page: number; index: number }[] = [];
    if (!texts || !needle) return out;
    for (let p = 0; p < texts.length && out.length < MAX_MATCHES; p++) {
      let k = 0;
      let at = texts[p].indexOf(needle);
      while (at >= 0 && out.length < MAX_MATCHES) {
        out.push({ page: p + 1, index: k++ });
        at = texts[p].indexOf(needle, at + needle.length);
      }
    }
    return out;
  }, [texts, needle]);

  // a new search starts at its first match
  useEffect(() => {
    setCur(0);
    if (matches.length) setFocusNonce((n) => n + 1);
  }, [matches]);

  const curMatch = matches[cur];

  // scrolls to the current match: straight to it if its page is drawn, otherwise to the page
  // (the page then draws itself and centres the match)
  useEffect(() => {
    if (!focusNonce || !curMatch || !root) return;
    setPageInput(String(curMatch.page));
    const el = root.querySelector("[data-search-current]");
    if (el) el.scrollIntoView({ block: "center", inline: "nearest" });
    else root.querySelector(`[data-pdf-page="${curMatch.page}"]`)?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchInput.current?.focus();
      searchInput.current?.select();
    });
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function step(dir: 1 | -1) {
    if (!matches.length) return;
    setCur((c) => (c + dir + matches.length) % matches.length);
    setFocusNonce((n) => n + 1);
  }

  // Ctrl/Cmd+F opens this search instead of the browser's, which can't see pages that aren't drawn yet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchStatus = !needle
    ? ""
    : !texts
      ? "Searching…"
      : matches.length === 0
        ? "No results"
        : `${Math.min(cur + 1, matches.length)} of ${matches.length}${matches.length >= MAX_MATCHES ? "+" : ""}`;

  // The address is a short-lived link, so the whole file is downloaded once up front (15 MB at most)
  // and opened from memory. Nothing else is requested from storage after that, even if the link expires.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let task: ReturnType<typeof pdfjs.getDocument> | undefined;

    (async () => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw Object.assign(new Error(`the storage server answered ${res.status}`), { name: "HttpError" });
      const data = new Uint8Array(await res.arrayBuffer());
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      const first = await pdf.getPage(1);
      if (cancelled) return;
      const v = first.getViewport({ scale: 1 });
      setBase({ w: v.width, h: v.height });
      setDoc(pdf);
    })().catch((err: { name?: string; message?: string }) => {
      console.error("Owlet PDF viewer:", err);
      if (cancelled || err?.name === "AbortError") return;
      const reason =
        err?.name === "InvalidPDFException" ? "the stored file isn't a valid PDF"
        : err?.name === "TypeError" ? "the browser blocked the download, which usually means a cross-origin (CORS) problem"
        : (err?.message ?? "unknown error").slice(0, 140);
      setError(`Couldn't load the original PDF (${reason}). You can still read and highlight the extracted text.`);
    });

    return () => {
      cancelled = true;
      controller.abort();
      void task?.destroy();
    };
  }, [url]);

  // "fit to width" zoom, kept up to date as the window changes.
  // 48px matches the scroll area's side padding on sm+; the cap keeps pages from getting huge on wide monitors.
  useEffect(() => {
    if (!root || !base) return;
    const update = () => {
      const next = Math.max(0.4, Math.min(1.6, (root.clientWidth - 48) / base.w));
      if (Math.abs(next - fitRef.current) > 0.001) {
        if (didFit.current) captureAnchor(); // the panel opening or the window resizing keeps your place
        fitRef.current = next;
        setFit(next);
      }
      didFit.current = true;
      setFitReady(true);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, base]);

  const scale = fit * zoom;

  // Remembers which part of the document is in the middle of the screen, so a zoom or a resize keeps it there.
  function captureAnchor() {
    if (!root) return;
    anchor.current = {
      x: (root.scrollLeft + root.clientWidth / 2) / (root.scrollWidth || 1),
      y: (root.scrollTop + root.clientHeight / 2) / (root.scrollHeight || 1),
    };
  }

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a || !root) return;
    anchor.current = null;
    root.scrollTop = a.y * root.scrollHeight - root.clientHeight / 2;
    root.scrollLeft = a.x * root.scrollWidth - root.clientWidth / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  function applyZoom(next: number) {
    const z = clampZoom(next);
    if (z === zoomRef.current) return;
    captureAnchor();
    zoomRef.current = z;
    setZoom(z);
  }
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  const fitWidth = () => applyZoom(1);
  function fitPage() {
    if (!root || !base) return;
    const byHeight = (root.clientHeight - 56) / base.h; // room for the page's margins and its "Page n" label
    const byWidth = (root.clientWidth - 48) / base.w;
    applyZoom(Math.min(byHeight, byWidth) / fit);
  }

  // Back to the page the person was on, once the page sizes are final. Only done once per opening.
  useEffect(() => {
    if (!fitReady || !root || !doc || restored.current) return;
    restored.current = true;
    const { page } = readSaved(storageKey);
    if (jumpTo || !page || page <= 1) return;
    const target = Math.min(page, doc.numPages);
    setPageInput(String(target));
    requestAnimationFrame(() => root.querySelector(`[data-pdf-page="${target}"]`)?.scrollIntoView({ block: "start" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitReady, root, doc]);

  // saves the page and zoom a moment after they stop changing (and never before the saved page was restored)
  useEffect(() => {
    const key = saveKey(storageKey);
    if (!key || !restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ page: Number(pageInput) || 1, zoom }));
      } catch {
        // storage can be unavailable (private mode); the position just isn't remembered
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pageInput, zoom, storageKey]);

  // Ctrl/Cmd + scroll (also a trackpad pinch on desktop) and a two-finger pinch on touch screens.
  // These need non-passive listeners, because the browser's own page zoom has to be cancelled.
  useEffect(() => {
    if (!root) return;

    let raf = 0;
    let factor = 1;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      factor *= Math.exp(-e.deltaY * 0.002);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const f = factor;
        factor = 1;
        applyZoomRef.current(zoomRef.current * f);
      });
    };

    // During the pinch only a CSS transform changes (smooth, nothing is redrawn); the zoom is applied when the fingers lift.
    let startDist = 0;
    let startZoom = 1;
    let ratio = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const reset = () => {
      if (content.current) {
        content.current.style.transform = "";
        content.current.style.transformOrigin = "";
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !content.current) return;
      startDist = dist(e.touches);
      startZoom = zoomRef.current;
      ratio = 1;
      const c = content.current.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - c.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - c.top;
      content.current.style.transformOrigin = `${mx}px ${my}px`;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!startDist || e.touches.length !== 2 || !content.current) return;
      e.preventDefault();
      ratio = clampZoom((startZoom * dist(e.touches)) / startDist) / startZoom;
      content.current.style.transform = `scale(${ratio})`;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!startDist || e.touches.length >= 2) return;
      startDist = 0;
      reset();
      if (ratio !== 1) applyZoomRef.current(startZoom * ratio);
      ratio = 1;
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);
    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      if (raf) cancelAnimationFrame(raf);
      reset();
    };
  }, [root]);

  // the zoom menu closes when you click elsewhere or press Escape
  useEffect(() => {
    if (!zoomMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!zoomMenuRef.current?.contains(e.target as Node)) setZoomMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [zoomMenu]);

  const byPage = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    for (const h of highlights) if (h.page) map.set(h.page, [...(map.get(h.page) ?? []), h]);
    return map;
  }, [highlights]);
  const unplaced = highlights.filter((h) => !h.page).length;

  function goTo(value: string) {
    const page = Math.min(Math.max(1, Math.floor(Number(value)) || 1), doc?.numPages ?? 1);
    setPageInput(String(page));
    root?.querySelector(`[data-pdf-page="${page}"]`)?.scrollIntoView({ block: "start" });
  }

  // jump requests from outside (for example, clicking a highlight in the side list)
  useEffect(() => {
    if (!jumpTo || !root || !doc) return;
    const page = Math.min(Math.max(1, Math.floor(jumpTo.page)), doc.numPages);
    setPageInput(String(page));
    root.querySelector(`[data-pdf-page="${page}"]`)?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.nonce, root, doc]);

  // keeps the page box showing the page at the top while scrolling
  function onScroll() {
    if (frame.current || !root) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const top = root.getBoundingClientRect().top;
      const first = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]")).find(
        (el) => el.getBoundingClientRect().bottom > top + 40
      );
      if (first?.dataset.pdfPage) setPageInput(first.dataset.pdfPage);
    });
  }

  function capture() {
    if (!canEdit || !root) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const owner = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>("[data-pdf-page]");
    const start = owner(range.startContainer);
    const end = owner(range.endContainer);
    if (!start || !root.contains(start)) return;
    if (start !== end) {
      setMessage("Select text on one page at a time.");
      return;
    }
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (text.length > 2000) {
      setMessage("Select at most 2000 characters at a time.");
      return;
    }
    const layer = start.querySelector<HTMLElement>(".textLayer");
    if (!layer) return;
    const rects = selectionRects(range, layer, start.getBoundingClientRect());
    if (!rects.length) return;
    setMessage("");
    resetExtras();
    setPending({ text, page: Number(start.dataset.pdfPage), rects });
  }

  // forgets the AI answer and the "Add to question" form that belong to the previous selection
  function resetExtras() {
    aiRequest.current += 1;
    setAi(null);
    setFiling(false);
    setNoteOpen(false);
  }

  function cancel() {
    setPending(null);
    setNote("");
    setMessage("");
    resetExtras();
    window.getSelection()?.removeAllRanges();
  }

  // the highlight as it will be saved, from the current selection, color and note
  function newHighlight(p: Pending): NewPdfHighlight {
    return {
      text: p.text,
      color,
      note: note.trim() || undefined,
      page: p.page,
      rects: p.rects,
      ...findOffsets(rawText, pageOffsets, p.page, p.text),
    };
  }

  async function save() {
    if (!pending || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await onCreate(newHighlight(pending));
      setPending(null);
      setNote("");
      resetExtras();
      window.getSelection()?.removeAllRanges();
    } catch {
      setMessage("Could not save the highlight. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // Saves the selection as a highlight and files it under a research question on the evidence board.
  async function fileUnderQuestion() {
    if (!pending || saving || !onCreateForQuestion) return;
    setSaving(true);
    setMessage("");
    try {
      const filed = await onCreateForQuestion(newHighlight(pending), {
        questionId: fileQuestion || null,
        stance: fileStance,
      });
      setPending(null);
      setNote("");
      resetExtras();
      window.getSelection()?.removeAllRanges();
      setNotice(filed ? "Highlighted and added to the evidence board." : "Highlight saved.");
    } catch {
      setMessage("Could not save the highlight. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function ask(mode: "explain" | "summarize") {
    if (!pending || !onAsk) return;
    const request = ++aiRequest.current;
    const quote = pending.text;
    setAi({ mode, status: "loading", text: "", quote });
    try {
      const text = await onAsk(quote, mode);
      if (request === aiRequest.current) setAi({ mode, status: "done", text, quote });
    } catch (e) {
      if (request === aiRequest.current) {
        setAi({ mode, status: "error", text: e instanceof Error ? e.message : "The AI couldn't answer. Try again.", quote });
      }
    }
  }

  if (error) return <p role="alert" className="py-10 text-center text-sm text-red-600">{error}</p>;
  if (!doc || !base) return <LoadingScreen label="Loading the PDF…" fill="parent" />;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goTo(pageInput);
          }}
          className="flex items-center gap-1.5"
        >
          <label htmlFor="pdf-page" className="font-medium">Page</label>
          <input
            id="pdf-page"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            inputMode="numeric"
            className="field !w-14 !px-2 !py-1 !text-xs"
          />
          <span>of {doc.numPages}</span>
        </form>
        {searchOpen && (
          <div className="flex items-center gap-1">
            <input
              ref={searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  step(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") {
                  closeSearch();
                }
              }}
              placeholder="Find in PDF"
              aria-label="Find in PDF"
              className="field !w-40 !px-2 !py-1 !text-xs sm:!w-56"
            />
            <span className="min-w-16 text-center tabular-nums" aria-live="polite">{searchStatus}</span>
            <button type="button" onClick={() => step(-1)} disabled={!matches.length} aria-label="Previous match" className="btn-secondary !p-1.5">
              <ChevronUp className="size-3.5" />
            </button>
            <button type="button" onClick={() => step(1)} disabled={!matches.length} aria-label="Next match" className="btn-secondary !p-1.5">
              <ChevronDown className="size-3.5" />
            </button>
            <button type="button" onClick={closeSearch} aria-label="Close search" className="btn-secondary !p-1.5">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : openSearch())}
            aria-label="Find in PDF"
            aria-pressed={searchOpen}
            className="btn-secondary !p-1.5"
          >
            <Search className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(zoomRef.current / ZOOM_STEP)}
            aria-label="Zoom out"
            title="Zoom out (or Ctrl + scroll)"
            className="btn-secondary !p-1.5"
          >
            <Minus className="size-3.5" />
          </button>
          <div ref={zoomMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setZoomMenu((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={zoomMenu}
              aria-label="Zoom options"
              className="btn-secondary !px-2 !py-1 !text-xs"
            >
              {Math.round(zoom * 100)}% <ChevronDown className="size-3" />
            </button>
            {zoomMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1 text-slate-700 shadow-lg"
              >
                <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { fitWidth(); setZoomMenu(false); }}>
                  Fit width
                </button>
                <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => { fitPage(); setZoomMenu(false); }}>
                  Fit page
                </button>
                <div className="my-1 border-t border-slate-100" />
                {[0.5, 0.75, 1.25, 1.5, 2, 3].map((z) => (
                  <button
                    key={z}
                    type="button"
                    role="menuitem"
                    className={MENU_ITEM}
                    onClick={() => { applyZoom(z); setZoomMenu(false); }}
                  >
                    {Math.round(z * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => applyZoom(zoomRef.current * ZOOM_STEP)}
            aria-label="Zoom in"
            title="Zoom in (or Ctrl + scroll)"
            className="btn-secondary !p-1.5"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={setRoot}
        onMouseUp={capture}
        onTouchEnd={capture}
        onScroll={onScroll}
        // our own pinch handler needs the browser's pinch-zoom switched off here (scrolling still works)
        style={{ touchAction: "pan-x pan-y" }}
        className="min-h-0 flex-1 overflow-auto bg-slate-100 px-2 py-4 sm:px-6"
      >
        <div ref={content}>
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PageView
              key={i + 1}
              doc={doc}
              n={i + 1}
              scale={scale}
              base={base}
              root={root}
              highlights={byPage.get(i + 1) ?? NONE}
              needle={searchOpen ? needle : ""}
              current={curMatch && curMatch.page === i + 1 ? curMatch.index : -1}
              focusNonce={focusNonce}
              activeId={activeId}
              onHighlightClick={onHighlightClick}
            />
          ))}
        </div>
      </div>

      {/* The selection tools float over the bottom of the document, so they take no room from it. */}
      {canEdit && (pending || notice || message) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
          {pending ? (
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-xl">
              <ColorPicker value={color} onChange={setColor} disabled={saving} />
              <button type="button" onClick={save} disabled={saving} className="btn-primary !px-3 !py-1.5 !text-xs">
                {saving ? "Saving…" : "Highlight"}
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen((open) => !open)}
                aria-expanded={noteOpen || !!note}
                aria-label="Add a note"
                title="Add a note"
                className="btn-secondary !p-1.5"
              >
                <StickyNote className="size-4" />
              </button>
              {(noteOpen || note) && (
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Note (optional)"
                  aria-label="Highlight note"
                  className="field !w-44 !py-1.5 !text-xs"
                />
              )}

              {(onAsk || (onCreateForQuestion && questions)) && <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />}

              {onAsk && (
                <>
                  <button
                    type="button"
                    onClick={() => ask("explain")}
                    disabled={saving || ai?.status === "loading"}
                    className="btn-secondary !px-2.5 !py-1.5 !text-xs"
                  >
                    <Sparkles className="size-3.5" /> Explain
                  </button>
                  <button
                    type="button"
                    onClick={() => ask("summarize")}
                    disabled={saving || ai?.status === "loading"}
                    className="btn-secondary !px-2.5 !py-1.5 !text-xs"
                  >
                    <Sparkles className="size-3.5" /> Summarize
                  </button>
                </>
              )}

              {onCreateForQuestion && questions && (
                <>
                  <button
                    type="button"
                    onClick={() => setFiling((open) => !open)}
                    aria-expanded={filing}
                    disabled={saving}
                    className="btn-secondary !px-2.5 !py-1.5 !text-xs"
                  >
                    <ListPlus className="size-3.5" /> To question
                  </button>
                  {filing && (
                    <>
                      <select
                        value={fileQuestion}
                        onChange={(e) => setFileQuestion(e.target.value)}
                        disabled={saving}
                        aria-label="Research question"
                        className="field !w-40 !py-1.5 !text-xs"
                      >
                        <option value="">No specific question</option>
                        {questions.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.kind === "main" ? "Main: " : ""}
                            {q.text.length > 60 ? q.text.slice(0, 60).trimEnd() + "…" : q.text}
                          </option>
                        ))}
                      </select>
                      <select
                        value={fileStance}
                        onChange={(e) => setFileStance(e.target.value as BoardStance)}
                        disabled={saving}
                        aria-label="How it relates to the question"
                        className="field !w-auto !py-1.5 !text-xs"
                      >
                        {(Object.keys(STANCE_LABEL) as BoardStance[]).map((st) => (
                          <option key={st} value={st}>
                            {STANCE_LABEL[st]}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={fileUnderQuestion} disabled={saving} className="btn-primary !px-3 !py-1.5 !text-xs">
                        {saving ? "Saving…" : "Add"}
                      </button>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                aria-label="Cancel selection"
                title="Cancel"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
              {message && (
                <span role="alert" className="w-full px-2 pb-0.5 text-xs text-red-600">
                  {message}
                </span>
              )}
            </div>
          ) : (
            <p
              role={message ? "alert" : "status"}
              className={`pointer-events-auto rounded-full px-3 py-1.5 text-xs text-white shadow-lg ${message ? "bg-red-600" : "bg-slate-800"}`}
            >
              {message || notice}
            </p>
          )}
        </div>
      )}

      {/* The AI's answer opens in a window you can move out of the way. */}
      <DraggableModal
        open={!!ai}
        onClose={() => {
          aiRequest.current += 1;
          setAi(null);
        }}
        title={ai?.mode === "summarize" ? "Summary" : "Explanation"}
      >
        {ai && (
          <div className="space-y-3 text-sm text-slate-700">
            <p className="break-words border-l-2 border-slate-300 pl-3 text-xs italic leading-5 text-slate-500">
              “{clip(ai.quote, 240)}”
            </p>
            {ai.status === "loading" ? (
              <p className="text-slate-400">Thinking…</p>
            ) : ai.status === "error" ? (
              <p role="alert" className="text-red-600">{ai.text}</p>
            ) : (
              <>
                <p className="whitespace-pre-line break-words leading-6">{ai.text}</p>
                <p className="text-[11px] text-slate-400">Written by AI from this text. Check it before you rely on it.</p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => ask(ai.mode === "explain" ? "summarize" : "explain")}
                disabled={ai.status === "loading"}
                className="btn-secondary !px-3 !py-1.5 !text-xs"
              >
                <Sparkles className="size-3.5" /> {ai.mode === "explain" ? "Summarize instead" : "Explain instead"}
              </button>
              {ai.status === "done" && (
                <button
                  type="button"
                  onClick={() => {
                    setNote(ai.text.slice(0, 1000));
                    setNoteOpen(true);
                  }}
                  className="btn-secondary !px-3 !py-1.5 !text-xs"
                >
                  <StickyNote className="size-3.5" /> Use as note
                </button>
              )}
            </div>
          </div>
        )}
      </DraggableModal>

      {unplaced > 0 && (
        <p className="shrink-0 border-t border-slate-200 bg-white px-4 py-1 text-[11px] text-slate-400">
          {unplaced} highlight{unplaced === 1 ? "" : "s"} can't be placed on a page. They stay in the highlight list.
        </p>
      )}
    </div>
  );
}