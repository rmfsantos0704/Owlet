import { Readability } from "@mozilla/readability";

// Turns a page's HTML into what a clip needs: the readable text and the details citations are made from.

export type Extracted = {
  title: string;
  rawText: string;
  author?: string;
  authors?: string[];
  publishedDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
};

// linkedom is loaded on first use, not when the server starts, so a problem loading it can only break
// page saving and never takes down login, health checks and every other route. The server is compiled
// with module "nodenext", so tsc leaves this import() alone and Node loads linkedom's own ES module build.
type ParseHTML = (html: string) => { document: any };
let parseHTMLPromise: Promise<ParseHTML> | undefined;
function loadParseHTML(): Promise<ParseHTML> {
  parseHTMLPromise ??= import("linkedom").then((m) => m.parseHTML as unknown as ParseHTML);
  return parseHTMLPromise;
}

const BLOCK = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "TR",
  "TABLE", "FIGURE", "FIGCAPTION", "HEADER", "FOOTER", "MAIN", "ASIDE", "DD", "DT", "DL", "HR",
]);

// text with paragraph breaks kept (plain textContent would run paragraphs together)
function nodeToText(root: any): string {
  const out: string[] = [];
  const walk = (node: any) => {
    if (node.nodeType === 3) {
      out.push(String(node.nodeValue ?? "").replace(/\s+/g, " "));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = String(node.tagName ?? "").toUpperCase();
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
    if (tag === "BR") {
      out.push("\n");
      return;
    }
    const block = BLOCK.has(tag);
    if (block) out.push("\n\n");
    for (const child of Array.from(node.childNodes ?? [])) walk(child);
    if (block) out.push("\n\n");
  };
  walk(root);
  return out
    .join("")
    .replace(/\r/g, "")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clip = (s: string | undefined, n: number) => (s ? s.trim().slice(0, n) : undefined) || undefined;

export async function extractPage(html: string): Promise<Extracted | null> {
  const parseHTML = await loadParseHTML();
  const { document } = parseHTML(html);

  // details come from the page's <meta> tags, read before the reader mode below changes the document
  const metas = new Map<string, string[]>();
  for (const el of Array.from(document.querySelectorAll("meta")) as any[]) {
    const key = String(el.getAttribute("name") || el.getAttribute("property") || el.getAttribute("itemprop") || "").toLowerCase();
    const value = String(el.getAttribute("content") ?? "").trim();
    if (!key || !value) continue;
    metas.set(key, [...(metas.get(key) ?? []), value]);
  }
  const first = (...keys: string[]) => keys.map((k) => metas.get(k)?.[0]).find(Boolean);

  const citationAuthors = (metas.get("citation_author") ?? metas.get("dc.creator") ?? []).map((a) => a.slice(0, 200)).slice(0, 30);
  const articleAuthor = (metas.get("article:author") ?? []).find((a) => !/^https?:\/\//i.test(a));
  const doiRaw = first("citation_doi", "dc.identifier", "prism.doi") ?? "";
  const doi = /10\.\d{4,9}\/\S+/.exec(doiRaw)?.[0];
  const firstPage = first("citation_firstpage");
  const lastPage = first("citation_lastpage");

  let article: { title?: string | null; textContent?: string | null; content?: string | null; byline?: string | null } | null = null;
  try {
    article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  } catch {
    article = null;
  }

  let rawText = article?.content ? nodeToText(parseHTML(`<body>${article.content}</body>`).document.body) : "";
  if (rawText.length < 200) {
    // reader mode found little: fall back to the page's main area, without menus and footers
    const { document: plain } = parseHTML(html);
    for (const el of Array.from(plain.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg,iframe")) as any[]) {
      el.remove();
    }
    const area = plain.querySelector("main") ?? plain.querySelector("article") ?? plain.body;
    const fallback = area ? nodeToText(area) : "";
    if (fallback.length > rawText.length) rawText = fallback;
  }
  rawText = rawText.slice(0, 200000);
  if (rawText.length < 50) return null;

  const byline = article?.byline?.replace(/^\s*by\s+/i, "").trim();
  const title =
    clip(first("citation_title"), 500) ??
    clip(article?.title ?? undefined, 500) ??
    clip(first("og:title", "twitter:title"), 500) ??
    clip(document.title, 500) ??
    "Untitled page";

  return {
    title,
    rawText,
    authors: citationAuthors.length ? citationAuthors : undefined,
    author: citationAuthors.length ? undefined : clip(first("author") ?? articleAuthor ?? byline, 200),
    publishedDate: clip(first("citation_publication_date", "citation_date", "article:published_time", "datepublished", "dc.date", "date"), 100),
    journal: clip(first("citation_journal_title", "prism.publicationname"), 300),
    volume: clip(first("citation_volume", "prism.volume"), 50),
    issue: clip(first("citation_issue", "prism.number"), 50),
    pages: clip(firstPage && lastPage ? `${firstPage}-${lastPage}` : firstPage, 80),
    doi: clip(doi, 200),
  };
}