import PDFDocument from "pdfkit";
import type { Response } from "express";

const NAVY = "#102b5c";
const INK = "#111111";
const BODY = "#222222";
const MUTED = "#666666";
const LIGHT = "#999999";
const LINK = "#1a56db";
const ACCENT = "#22d3ee";
const R = "Helvetica";
const B = "Helvetica-Bold";
const I = "Helvetica-Oblique";
const UNCAT = "Uncategorized";

// keeps one export from growing without limit
const MAX_PAGES = 400;
const MAX_PER_ITEM = 100; // highlights and comments shown per clip
const MAX_TEXT = 1500; // characters shown per highlight, note or comment

const STYLES = [
  { key: "apa", label: "APA" },
  { key: "mla", label: "MLA" },
  { key: "chicago", label: "Chicago" },
] as const;

// Built-in PDF fonts only cover Latin text, so anything else becomes "?".
const clean = (s: unknown) =>
  String(s ?? "").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u2022]/g, "?");

const cut = (s: unknown, n = MAX_TEXT) => {
  const t = clean(s);
  return t.length > n ? t.slice(0, n) + "..." : t;
};

// only real web addresses become clickable
const webLink = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : undefined);

const titleCase = (s: string) =>
  s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const sortKey = (s: string) => clean(s).replace(/^[^a-z0-9]+/i, "").toLowerCase();

// Each clip goes under ONE topic: its most widely shared tag in this collection (ties: alphabetical).
function groupByTopic(items: any[]) {
  const freq = new Map<string, number>();
  for (const it of items) {
    for (const t of new Set<string>((it.tags ?? []).map(String))) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const groups = new Map<string, any[]>();
  for (const it of items) {
    const tags: string[] = (it.tags ?? []).map(String).filter(Boolean);
    const best = tags.length
      ? [...tags].sort((a, b) => (freq.get(b)! - freq.get(a)!) || a.localeCompare(b))[0]
      : UNCAT;
    const label = best === UNCAT ? UNCAT : titleCase(best);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(it);
  }
  return [...groups.entries()]
    .sort(([a, x], [b, y]) => (a === UNCAT ? 1 : b === UNCAT ? -1 : 0) || y.length - x.length || a.localeCompare(b))
    .map(([topic, list]) => ({ topic, items: list }));
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function streamcollectionPdf(
  ws: { name: string; description?: string },
  items: any[],
  mode: "full" | "citations",
  omitted: number,
  res: Response
) {
  const slug = clean(ws.name).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "collection";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-${mode === "full" ? "report" : "citations"}.pdf"`);

  const doc = new PDFDocument({
    margin: 56,
    size: "A4",
    bufferPages: true,
    info: { Title: `${clean(ws.name)} (Owlet)`, Producer: "Owlet" },
  });
  doc.pipe(res);

  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const pageIdx = () => doc.bufferedPageRange().count - 1;
  const ensure = (h: number) => {
    if (doc.y + h > bottom()) doc.addPage();
    doc.x = L;
  };

  const marks = new Map<string, number>(); // destination name -> page number
  const toc: { dest: string; y: number; page: number; size: number; bold: boolean }[] = [];

  const mark = (name: string) => {
    doc.addNamedDestination(name, "XYZ", 0, doc.page.height - doc.y + 14, null);
    marks.set(name, pageIdx() + 1);
  };

  const tocLine = (label: string, dest: string, indent: number, bold: boolean, size: number) => {
    ensure(size + 8);
    const y = doc.y;
    doc.font(bold ? B : R).fontSize(size).fillColor(bold ? INK : LINK)
      .text(clean(label), L + indent, y, { goTo: dest, lineBreak: false });
    toc.push({ dest, y, page: pageIdx(), size, bold });
    doc.x = L;
    doc.y = y + size + 7;
  };

  const rule = (color = "#e2e8f0", width = 0.7) => {
    const y = doc.y;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(width).strokeColor(color).stroke();
    doc.x = L;
    doc.y = y + 8;
  };

  const partTitle = (t: string) => {
    doc.font(B).fontSize(18).fillColor(NAVY).text(clean(t), L, doc.y, { width: W });
    doc.y += 4;
    rule(ACCENT, 1.5);
    doc.moveDown(0.4);
  };

  const topicHeading = (t: string, n: number) => {
    doc.font(B).fontSize(13).fillColor(NAVY).text(`${clean(t)}  (${n})`, L, doc.y, { width: W });
    doc.y += 2;
    rule();
  };

  const label = (t: string) => {
    doc.moveDown(0.35).font(B).fontSize(8.5).fillColor(LIGHT).text(t.toUpperCase(), L, doc.y, { width: W, characterSpacing: 0.6 });
    doc.moveDown(0.15);
  };

  const body = (t: unknown) =>
    doc.font(R).fontSize(10).fillColor(BODY).text(clean(t) || "-", L, doc.y, { width: W, lineGap: 2 });

  const more = (n: number, what: string) =>
    doc.font(I).fontSize(9).fillColor(LIGHT).text(`... and ${n} more ${what}`, L + 6, doc.y, { width: W - 6 });

  const topics = groupByTopic(items);
  let cutShort = false; // set when the report part hits the page limit

  // ---------- cover + contents ----------
  doc.font(B).fontSize(26).fillColor(NAVY).text(clean(ws.name) || "collection", L, doc.y, { width: W });
  doc.moveDown(0.2).font(R).fontSize(11).fillColor(MUTED)
    .text(mode === "full" ? "Research report" : "Citation list", L, doc.y, { width: W });
  if (ws.description?.trim()) {
    doc.moveDown(0.6).fontSize(10.5).fillColor(BODY).text(clean(ws.description), L, doc.y, { width: W, lineGap: 2 });
  }
  doc.moveDown(0.6).fontSize(9.5).fillColor(LIGHT).text(
    `${items.length} ${items.length === 1 ? "source" : "sources"} \u00B7 ${topics.length} ${topics.length === 1 ? "topic" : "topics"} \u00B7 Generated ${fmtDate(new Date())}`,
    L, doc.y, { width: W }
  );
  if (omitted > 0) {
    doc.text(`Showing the ${items.length} most recent of ${items.length + omitted} clips.`, L, doc.y, { width: W });
  }
  doc.moveDown(1.2);
  rule(ACCENT, 1.5);
  doc.font(B).fontSize(14).fillColor(INK).text("Contents", L, doc.y, { width: W });
  doc.moveDown(0.6);

  if (mode === "full") {
    tocLine("Sources by topic", "p1", 0, true, 11);
    topics.forEach((t, i) => tocLine(`${t.topic} (${t.items.length})`, `p1:${i}`, 14, false, 10));
    doc.y += 6;
  }
  tocLine("Citations by style", "bib", 0, true, 11);
  // with many topics, listing them under every style would fill pages; the bookmarks panel covers that case
  const compact = topics.length > 12;
  for (const st of STYLES) {
    tocLine(st.label, `bib:${st.key}`, 14, true, 10.5);
    if (!compact) topics.forEach((t, i) => tocLine(`${t.topic} (${t.items.length})`, `bib:${st.key}:${i}`, 28, false, 9.5));
  }
  if (compact) {
    doc.font(I).fontSize(9).fillColor(LIGHT).text(
      "Each style lists the same topics in the same order. Use your PDF viewer's bookmarks panel to jump straight to a topic.",
      L + 14, doc.y, { width: W - 14 }
    );
  }

  // ---------- part 1: sources by topic ----------
  if (mode === "full") {
    doc.addPage();
    mark("p1");
    const o1 = doc.outline.addItem("Sources by topic", { expanded: true });
    partTitle("Sources by topic");

    topics.forEach((t, i) => {
      if (cutShort) return;
      ensure(110);
      mark(`p1:${i}`);
      o1.addItem(clean(t.topic));
      topicHeading(t.topic, t.items.length);

      const sorted = [...t.items].sort((a, b) => sortKey(a.source?.title ?? "").localeCompare(sortKey(b.source?.title ?? "")));
      for (const it of sorted) {
        if (pageIdx() >= MAX_PAGES) {
          cutShort = true;
          break;
        }
        const s = it.source ?? {};
        ensure(90);
        doc.font(B).fontSize(11.5).fillColor(INK).text(clean(s.title || s.fileName || s.url || "Untitled"), L, doc.y, { width: W });
        const origin = s.kind === "pdf" ? `PDF${s.fileName ? ` \u00B7 ${s.fileName}` : ""}` : s.domain;
        const meta = [s.author, s.publishedDate, origin].filter(Boolean).map(clean).join("  \u00B7  ");
        if (meta) doc.font(R).fontSize(9).fillColor(MUTED).text(meta, L, doc.y + 1, { width: W });
        if (s.url) {
          const href = webLink(s.url);
          doc.font(R).fontSize(9).fillColor(href ? LINK : MUTED).text(clean(s.url), L, doc.y, { width: W, link: href, underline: !!href });
        }
        if (it.tags?.length) {
          doc.font(R).fontSize(9).fillColor(LIGHT).text(it.tags.map((x: string) => "#" + clean(x)).join("  "), L, doc.y + 1, { width: W });
        }
        if (it.aiOutput?.summary) { label("Summary"); body(it.aiOutput.summary); }
        if (it.aiOutput?.paraphrase) { label("Key arguments"); body(it.aiOutput.paraphrase); }
        if (it.highlights?.length) {
          label("Highlights");
          for (const h of it.highlights.slice(0, MAX_PER_ITEM)) {
            ensure(30);
            doc.font(R).fontSize(10).fillColor(BODY).text(`\u2022 "${cut(h.text)}"`, L + 6, doc.y, { width: W - 6, lineGap: 2 });
            if (h.note) doc.font(I).fontSize(9).fillColor(MUTED).text(`Note: ${cut(h.note)}`, L + 16, doc.y, { width: W - 16 });
            doc.moveDown(0.2);
          }
          if (it.highlights.length > MAX_PER_ITEM) more(it.highlights.length - MAX_PER_ITEM, "highlights");
        }
        if (it.comments?.length) {
          label("Comments");
          for (const c of it.comments.slice(0, MAX_PER_ITEM)) {
            ensure(28);
            doc.font(R).fontSize(10).fillColor(BODY).text(cut(c.text), L + 6, doc.y, { width: W - 6, lineGap: 2 });
            const by = [c.authorEmail, c.createdAt ? fmtDate(new Date(c.createdAt)) : ""].filter(Boolean).map(clean).join(" \u00B7 ");
            if (by) doc.font(R).fontSize(8.5).fillColor(LIGHT).text(by, L + 6, doc.y, { width: W - 6 });
            doc.moveDown(0.25);
          }
          if (it.comments.length > MAX_PER_ITEM) more(it.comments.length - MAX_PER_ITEM, "comments");
        }
        doc.moveDown(0.5);
        rule();
        doc.moveDown(0.3);
      }
      doc.moveDown(0.6);
    });

    if (cutShort) {
      ensure(50);
      doc.font(I).fontSize(9.5).fillColor(MUTED).text(
        "This report was cut short to keep the file a manageable size. The citation lists that follow are complete.",
        L, doc.y, { width: W }
      );
    }
  }

  // ---------- part 2: citations by style, then by topic ----------
  let bibOutline: ReturnType<typeof doc.outline.addItem> | null = null;
  STYLES.forEach((st, si) => {
    doc.addPage();
    mark(`bib:${st.key}`);
    if (si === 0) mark("bib");
    if (!bibOutline) bibOutline = doc.outline.addItem("Citations by style", { expanded: true });
    const so = bibOutline.addItem(st.label, { expanded: false });
    partTitle(`Citations \u00B7 ${st.label}`);
    doc.font(I).fontSize(8.5).fillColor(LIGHT)
      .text("Auto-generated from page and file details. Verify before submitting.", L, doc.y, { width: W });
    doc.moveDown(0.8);

    topics.forEach((t, i) => {
      ensure(80);
      mark(`bib:${st.key}:${i}`);
      so.addItem(clean(t.topic));
      topicHeading(t.topic, t.items.length);

      const entries = t.items
        .map((it) => clean(it.citations?.[st.key] ?? "").trim() || "(No citation available)")
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }));
      for (const text of entries) {
        ensure(44);
        doc.font(R).fontSize(10.5).fillColor(BODY).text(text, L, doc.y, { width: W, lineGap: 2 });
        doc.moveDown(0.7);
      }
      doc.moveDown(0.4);
    });
  });

  // ---------- fill in contents page numbers ----------
  for (const e of toc) {
    const pg = marks.get(e.dest);
    if (!pg) continue;
    doc.switchToPage(e.page);
    doc.font(e.bold ? B : R).fontSize(e.size).fillColor(MUTED)
      .text(String(pg), L, e.y, { width: W, align: "right", lineBreak: false });
  }

  // ---------- footer on every page ----------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const m = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // otherwise text this low would spawn a new page
    doc.font(R).fontSize(8).fillColor(LIGHT)
      .text(`${clean(ws.name).slice(0, 60)} \u00B7 Page ${i + 1} of ${range.count}`, L, doc.page.height - 34, {
        width: W, align: "center", lineBreak: false,
      });
    doc.page.margins.bottom = m;
  }

  doc.end();
}