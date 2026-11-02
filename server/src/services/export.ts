import { deflateRawSync } from "node:zlib";
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

const markdownText = (value: unknown) =>
  String(value ?? "").replace(/\r\n?/g, "\n").replace(/([\\`*_{}\[\]()#+.!|>])/g, "\\$1").trim();

const markdownUrl = (value: unknown) => {
  const url = String(value ?? "").trim();
  return /^https?:\/\/\S+$/i.test(url)
    ? `<${url.replace(/[<>]/g, (char) => char === "<" ? "%3C" : "%3E")}>`
    : markdownText(url);
};

export function toCollectionMarkdown(
  collection: { name: string; description?: string },
  items: any[],
  total: number
) {
  const lines = [
    `# ${markdownText(collection.name) || "Collection"}`,
    "",
    collection.description ? markdownText(collection.description) : "",
    "",
    `Exported ${items.length} of ${total} sources.`,
  ];

  for (const item of items) {
    const source = item.source ?? {};
    lines.push("", `## ${markdownText(source.title || source.fileName || source.url || "Untitled")}`);

    const metadata = [
      source.author && `**Author:** ${markdownText(source.author)}`,
      source.publishedDate && `**Published:** ${markdownText(source.publishedDate)}`,
      source.url && `**URL:** ${markdownUrl(source.url)}`,
      item.tags?.length && `**Tags:** ${item.tags.map(markdownText).join(", ")}`,
    ].filter(Boolean);
    lines.push(...metadata, "");

    if (item.personalNote) lines.push("### My note", "", markdownText(item.personalNote), "");
    if (item.userSummary) lines.push("### My summary", "", markdownText(item.userSummary), "");
    if (item.aiOutput?.summary) lines.push("### Summary", "", markdownText(item.aiOutput.summary), "");
    if (item.aiOutput?.paraphrase) lines.push("### Key arguments", "", markdownText(item.aiOutput.paraphrase), "");

    if (item.highlights?.length) {
      lines.push("### Highlights", "");
      for (const highlight of item.highlights) {
        lines.push(`- “${markdownText(highlight.text)}”${highlight.note ? ` — ${markdownText(highlight.note)}` : ""}`);
      }
      lines.push("");
    }

    if (item.comments?.length) {
      lines.push("### Comments", "");
      for (const comment of item.comments) {
        const author = comment.authorEmail ? ` — ${markdownText(comment.authorEmail)}` : "";
        lines.push(`- ${markdownText(comment.text)}${author}`);
      }
      lines.push("");
    }

    const citations = [
      ["APA", item.citations?.apa],
      ["MLA", item.citations?.mla],
      ["Chicago", item.citations?.chicago],
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1].trim());
    if (citations.length) {
      lines.push("### Citations", "");
      for (const [style, citation] of citations) lines.push(`- **${style}:** ${markdownText(citation)}`);
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

function xmlText(value: unknown) {
  return Array.from(String(value ?? ""))
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return code === 0x09 || code === 0x0a || code === 0x0d ||
        (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff);
    })
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function docxParagraph(value: unknown, style?: "Title" | "Heading1" | "Heading2") {
  const properties = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  const runs = String(value ?? "").split(/\r\n?|\n/).map((line, index) =>
    `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xmlText(line)}</w:t></w:r>`
  ).join("");
  return `<w:p>${properties}${runs}</w:p>`;
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFiles(files: { name: string; content: string }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const source = Buffer.from(file.content, "utf8");
    const compressed = deflateRawSync(source);
    const checksum = crc32(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function toCollectionDocx(
  collection: { name: string; description?: string },
  items: any[],
  total: number
) {
  const paragraphs = [
    docxParagraph(collection.name || "Collection", "Title"),
    ...(collection.description ? [docxParagraph(collection.description)] : []),
    docxParagraph(`Exported ${items.length} of ${total} sources.`),
  ];

  for (const item of items) {
    const source = item.source ?? {};
    paragraphs.push(docxParagraph(source.title || source.fileName || source.url || "Untitled", "Heading1"));
    for (const [label, value] of [
      ["Author", source.author],
      ["Published", source.publishedDate],
      ["URL", source.url],
      ["Tags", item.tags?.join(", ")],
    ]) {
      if (value) paragraphs.push(docxParagraph(`${label}: ${value}`));
    }

    for (const [heading, value] of [
      ["My note", item.personalNote],
      ["My summary", item.userSummary],
      ["Summary", item.aiOutput?.summary],
      ["Key arguments", item.aiOutput?.paraphrase],
    ]) {
      if (value) paragraphs.push(docxParagraph(heading, "Heading2"), docxParagraph(value));
    }

    if (item.highlights?.length) {
      paragraphs.push(docxParagraph("Highlights", "Heading2"));
      for (const highlight of item.highlights) {
        paragraphs.push(docxParagraph(`• “${highlight.text}”${highlight.note ? ` — ${highlight.note}` : ""}`));
      }
    }

    if (item.comments?.length) {
      paragraphs.push(docxParagraph("Comments", "Heading2"));
      for (const comment of item.comments) {
        paragraphs.push(docxParagraph(`${comment.text}${comment.authorEmail ? ` — ${comment.authorEmail}` : ""}`));
      }
    }

    const citations = [
      ["APA", item.citations?.apa],
      ["MLA", item.citations?.mla],
      ["Chicago", item.citations?.chicago],
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1].trim());
    if (citations.length) {
      paragraphs.push(docxParagraph("Citations", "Heading2"));
      for (const [style, citation] of citations) paragraphs.push(docxParagraph(`${style}: ${citation}`));
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="102B5C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="102B5C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

  return zipFiles([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      name: "word/document.xml",
      content: documentXml,
    },
    {
      name: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "word/styles.xml",
      content: stylesXml,
    },
  ]);
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