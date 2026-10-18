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
  const header = ["title", "author", "url", "domain", "published_date", "clipped_at", "tags", "summary", "apa", "mla", "chicago"];
  const rows = items.map((it) => [
    it.source?.title, it.source?.author, it.source?.url, it.source?.domain, it.source?.publishedDate,
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
    const a = s.author ? splitName(s.author) : null;
    const date = s.publishedDate ? new Date(s.publishedDate) : null;
    const year = date && !isNaN(date.getTime()) ? date.getFullYear() : "";

    const lead = a && !a.raw ? a.last : (s.author ?? s.domain ?? "ref").split(/\s+/)[0];
    const titleWord = (s.title ?? "").split(/\s+/).find((w: string) => ascii(w).length > 3) ?? "";
    let key = (ascii(lead) + year + ascii(titleWord)).toLowerCase() || "ref";
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    if (n) key += `-${n}`;

    const fields: [string, string][] = [
      ["author", a ? (a.raw ? `{${esc(a.last)}}` : esc(`${a.last}, ${a.first}`)) : ""],
      ["title", `{${esc(s.title)}}`],
      ["year", String(year)],
      ["howpublished", esc(s.domain)],
      ["url", (s.url ?? "").replace(/[{}\s]/g, "")],
      ["urldate", day(it.createdAt)],
    ];
    return `@misc{${key},\n` + fields.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${v}}`).join(",\n") + "\n}";
  });
  return entries.join("\n\n") + "\n";
}