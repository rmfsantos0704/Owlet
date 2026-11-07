import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { Minus, Plus } from "lucide-react";
import ColorPicker from "../shared/ColorPicker";
import { styleFor } from "../../utils/colors";
import type { Highlight } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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

// finds a highlight's wording in a page's text layer and returns where it sits (best effort)
function locate(root: HTMLElement, text: string, pageRect: DOMRect): Rect[] {
  const needle = squash(text);
  if (needle.length < 3) return [];
  const { hay, map } = buildIndex(root);
  const at = hay.indexOf(needle);
  if (at < 0) return [];
  const end = at + needle.length;
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
  doc, n, scale, base, root, highlights,
}: {
  doc: PDFDocumentProxy;
  n: number;
  scale: number;
  base: { w: number; h: number };
  root: HTMLElement | null;
  highlights: Highlight[];
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

  const w = size?.scale === scale ? size.w : base.w * scale;
  const h = size?.scale === scale ? size.h : base.h * scale;

  return (
    <div className="mb-4">
      <div
        ref={wrap}
        data-pdf-page={n}
        className="relative mx-auto bg-white shadow-md"
        style={{ width: w, height: h, "--scale-factor": scale, "--total-scale-factor": scale } as CSSProperties}
      >
        <canvas ref={canvas} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          {highlights.flatMap((hl) =>
            (hl.rects?.length ? hl.rects : located[hl._id] ?? []).map((r, i) => (
              <div
                key={`${hl._id}-${i}`}
                title={hl.note || undefined}
                className={`absolute rounded-sm opacity-40 mix-blend-multiply ${styleFor(hl.color).dot}`}
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

export default function PdfViewer({ url, rawText, pageOffsets, highlights, canEdit, onCreate, jumpTo }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const [pending, setPending] = useState<Pending | null>(null);
  const [color, setColor] = useState("yellow");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const frame = useRef(0);

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
    const update = () => setFit(Math.max(0.4, Math.min(1.6, (root.clientWidth - 48) / base.w)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, [root, base]);

  const scale = fit * zoom;

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
    setPending({ text, page: Number(start.dataset.pdfPage), rects });
  }

  function cancel() {
    setPending(null);
    setNote("");
    setMessage("");
    window.getSelection()?.removeAllRanges();
  }

  async function save() {
    if (!pending || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await onCreate({
        text: pending.text,
        color,
        note: note.trim() || undefined,
        page: pending.page,
        rects: pending.rects,
        ...findOffsets(rawText, pageOffsets, pending.page, pending.text),
      });
      setPending(null);
      setNote("");
      window.getSelection()?.removeAllRanges();
    } catch {
      setMessage("Could not save the highlight. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p role="alert" className="py-10 text-center text-sm text-red-600">{error}</p>;
  if (!doc || !base) return <p className="py-10 text-center text-sm text-slate-400">Loading the PDF…</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
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
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} aria-label="Zoom out" className="btn-secondary !p-1.5">
            <Minus className="size-3.5" />
          </button>
          <button type="button" onClick={() => setZoom(1)} className="btn-secondary !px-2 !py-1 !text-xs">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} aria-label="Zoom in" className="btn-secondary !p-1.5">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {canEdit && (
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          {pending ? (
            <div className="space-y-2.5">
              <p className="break-words text-xs italic leading-5 text-slate-600">
                “{clip(pending.text)}” <span className="not-italic text-slate-400">· page {pending.page}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ColorPicker value={color} onChange={setColor} disabled={saving} />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder="Add a note (optional)"
                  aria-label="Highlight note"
                  className="field min-w-40 flex-1"
                />
                <button type="button" onClick={cancel} disabled={saving} className="btn-secondary">Cancel</button>
                <button type="button" onClick={save} disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : "Add highlight"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select text on a page to highlight it.</p>
          )}
          {message && <p role="alert" className="mt-2 text-xs text-red-600">{message}</p>}
        </div>
      )}

      <div
        ref={setRoot}
        onMouseUp={capture}
        onTouchEnd={capture}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto bg-slate-100 px-2 py-4 sm:px-6"
      >
        {Array.from({ length: doc.numPages }, (_, i) => (
          <PageView
            key={i + 1}
            doc={doc}
            n={i + 1}
            scale={scale}
            base={base}
            root={root}
            highlights={byPage.get(i + 1) ?? NONE}
          />
        ))}
      </div>

      {unplaced > 0 && (
        <p className="shrink-0 border-t border-slate-200 bg-white px-4 py-1 text-[11px] text-slate-400">
          {unplaced} highlight{unplaced === 1 ? "" : "s"} can't be placed on a page. They stay in the highlight list.
        </p>
      )}
    </div>
  );
}