import { splitName } from "./citations.js";

const day = (d?: Date | string) => {
  const x = d ? new Date(d) : null;
  return x && !isNaN(x.getTime()) ? x.toISOString().slice(0, 10) : "";
};

// Page titles are untrusted. A leading = + - @ can run as a formula in Excel, so defuse it.
function cell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(items: any[]) {
  const header = ["title", "author", "url", "domain", "published_date", "journal", "volume", "issue", "pages", "doi", "reading_status", "personal_note", "my_summary", "clipped_at", "tags", "summary", "apa", "mla", "chicago"];
  const rows = items.map((it) => [
    it.source?.title, it.source?.author, it.source?.url, it.source?.domain, it.source?.publishedDate,
    it.source?.journal, it.source?.volume, it.source?.issue, it.source?.pages, it.source?.doi,
    it.readingStatus ?? "to_read", it.personalNote, it.userSummary,
    day(it.createdAt), (it.tags ?? []).join("; "), it.aiOutput?.summary,
    it.citations?.apa, it.citations?.mla, it.citations?.chicago,
  ]);
  return "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

const esc = (s = "") =>
  s.replace(/[{}\\~^]/g, "").replace(/([&%$#_])/g, "\\$1").replace(/\s+/g, " ").trim();
const ascii = (t = "") => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");

export function toBibtex(items: any[]) {
  const used = new Map<string, number>();
  const entries = items.map((it) => {
    const s = it.source ?? {};
    const authors = Array.isArray(s.authors) && s.authors.length
      ? s.authors.map((name: string) => splitName(name))
      : s.author ? s.author.split(/\s*;\s*/).filter(Boolean).map(splitName) : [];
    const date = s.publishedDate ? new Date(s.publishedDate) : null;
    const year = date && !isNaN(date.getTime()) ? date.getFullYear() : "";

    const first = authors[0];
    const lead = first && !first.raw ? first.last : (s.author ?? s.domain ?? "ref").split(/\s+/)[0];
    const titleWord = (s.title ?? "").split(/\s+/).find((w: string) => ascii(w).length > 3) ?? "";
    let key = (ascii(lead) + year + ascii(titleWord)).toLowerCase() || "ref";
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    if (n) key += `-${n}`;

    const fields: [string, string][] = [
      ["author", authors.map((a: ReturnType<typeof splitName>) => a.raw ? `{${esc(a.last)}}` : esc(`${a.last}, ${a.first}`)).join(" and ")],
      ["title", `{${esc(s.title)}}`],
      ["year", String(year)],
      ["journal", esc(s.journal)],
      ["volume", esc(s.volume)],
      ["number", esc(s.issue)],
      ["pages", esc(s.pages)],
      ["doi", esc(s.doi)],
      ["howpublished", esc(s.domain)],
      ["url", (s.url ?? "").replace(/[{}\s]/g, "")],
      ["urldate", day(it.createdAt)],
    ];
    return `@${s.journal ? "article" : "misc"}{${key},\n` + fields.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${v}}`).join(",\n") + "\n}";
  });
  return entries.join("\n\n") + "\n";
}

const risValue = (value: unknown) =>
  String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

export function toRis(items: any[]) {
  return items.map((item) => {
    const source = item.source ?? {};
    const authorList = Array.isArray(source.authors) && source.authors.length
      ? source.authors
      : source.author ? source.author.split(/\s*;\s*/).filter(Boolean) : [];
    const published = risValue(source.publishedDate);
    const year = published.match(/\b\d{4}\b/)?.[0] ?? "";
    const fields: string[] = [
      `TY  - ${source.journal ? "JOUR" : source.kind === "pdf" ? "GEN" : "ELEC"}`,
      ...authorList.map((author: unknown) => `AU  - ${risValue(author)}`),
    ];
    const add = (tag: string, value: unknown) => {
      const clean = risValue(value);
      if (clean) fields.push(`${tag}  - ${clean}`);
    };
    add("TI", source.title);
    add("T2", source.journal);
    add("VL", source.volume);
    add("IS", source.issue);
    const pages = risValue(source.pages);
    if (pages) {
      const range = pages.match(/^(.+?)[-–](.+)$/);
      add("SP", range?.[1] ?? pages);
      if (range) add("EP", range[2]);
    }

    add("DO", risValue(source.doi).replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""));
    add("UR", source.url);
    add("PY", year);
    add("Y1", published);
    fields.push("ER  - ");
    return fields.join("\r\n");
  }).join("\r\n\r\n") + (items.length ? "\r\n" : "");
}

export function toLiteratureMatrixCsv(
  items: any[],
  columns: { id: string; name: string }[]
) {
  const headers = ["title", ...columns.map((column) => column.name)];
  const rows = items.map((item) => {
    const values = item.matrixValues instanceof Map
      ? Object.fromEntries(item.matrixValues)
      : item.matrixValues ?? {};
    return [item.source?.title ?? "Untitled", ...columns.map((column) => values[column.id] ?? "")];
  });
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}