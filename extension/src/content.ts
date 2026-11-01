import { Readability } from "@mozilla/readability";
import { normalizePageUrl } from "./pageUrl";

const w = window as Window & { __owletReady?: boolean };

if (!w.__owletReady) {
  w.__owletReady = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "OWLET_EXTRACT") return;

    const metaValues = (names: string[]) => {
      const values: string[] = [];
      for (const n of names) {
        for (const el of document.querySelectorAll<HTMLMetaElement>(`meta[name="${n}"], meta[property="${n}"]`)) {
          const value = el.content.trim();
          if (value && !values.includes(value)) values.push(value);
        }
      }
      return values;
    };

    const meta = (names: string[]) => metaValues(names)[0];
    const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const selection = window.getSelection()?.toString().trim() ?? "";
    const article = new Readability(document.cloneNode(true) as Document).parse();
    const structuredArticles: Record<string, unknown>[] = [];
    const collectStructured = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(collectStructured);
        return;
      }
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
      if (types.some((type) => typeof type === "string" && /article|report|thesis/i.test(type))) {
        structuredArticles.push(record);
      }
      if (record["@graph"]) collectStructured(record["@graph"]);
      if (record.mainEntity) collectStructured(record.mainEntity);
      if (record.mainEntityOfPage) collectStructured(record.mainEntityOfPage);
    };
    for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
      try {
        collectStructured(JSON.parse(script.textContent ?? ""));
      } catch {
        continue;
      }
    }
    const jsonValue = (key: string) => structuredArticles.find((entry) => entry[key] != null)?.[key];
    const jsonText = (value: unknown): string | undefined => {
      if (typeof value === "string") return value.trim() || undefined;
      if (value && typeof value === "object" && "name" in value) {
        const name = (value as { name?: unknown }).name;
        return typeof name === "string" ? name.trim() || undefined : undefined;
      }
      return undefined;
    };
    const jsonAuthors = structuredArticles.flatMap((entry) => {
      const value = entry.author;
      return (Array.isArray(value) ? value : value ? [value] : []).map(jsonText).filter((name): name is string => !!name);
    });
    const jsonIdentifiers = structuredArticles.flatMap((entry) => {
      const value = entry.identifier;
      const identifiers = Array.isArray(value) ? value : value ? [value] : [];
      return identifiers.flatMap((identifier) => {
        if (typeof identifier === "string") return [identifier];
        if (!identifier || typeof identifier !== "object") return [];
        const record = identifier as Record<string, unknown>;
        return [record.value, record["@id"], record.name].filter((part): part is string => typeof part === "string");
      });
    });
    const authors = (
      metaValues(["citation_author", "dc.creator", "dcterms.creator", "author", "article:author"]).length
        ? metaValues(["citation_author", "dc.creator", "dcterms.creator", "author", "article:author"])
        : jsonAuthors
    ).slice(0, 30).map((name) => name.slice(0, 200));
    const author = (authors[0] || article?.byline || "").replace(/^by\s+/i, "").trim();
    const publicationDate =
      meta(["citation_publication_date", "citation_date", "article:published_time", "dc.date", "dcterms.date", "prism.publicationdate", "date", "pubdate"]) ||
      jsonText(jsonValue("datePublished")) ||
      jsonText(jsonValue("dateCreated"));
    const journal =
      meta(["citation_journal_title", "citation_conference_title", "dc.source", "dcterms.source", "prism.publicationname"]) ||
      jsonText((jsonValue("isPartOf") as Record<string, unknown> | undefined)?.name);
    const firstPage = meta(["citation_firstpage"]);
    const lastPage = meta(["citation_lastpage"]);
    const pageRange = firstPage && lastPage && firstPage !== lastPage ? `${firstPage}-${lastPage}` : firstPage || lastPage;
    const doiCandidates = [
      ...metaValues(["citation_doi", "prism.doi", "dc.identifier", "dcterms.identifier"]),
      ...jsonIdentifiers,
    ];
    const doiValue = doiCandidates.find((value) =>
      /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\//i.test(value.trim())
    )?.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    const body = selection.length >= 50 ? selection : article?.textContent || document.body.innerText;

    sendResponse({
      url: normalizePageUrl(location.href),
      title: (meta(["citation_title", "og:title"]) || jsonText(jsonValue("headline")) || jsonText(jsonValue("name")) || article?.title || document.title || "Untitled").trim().slice(0, 500),
      author: author ? author.slice(0, 200) : undefined,
      authors: authors.length ? authors : undefined,
      publishedDate: publicationDate?.slice(0, 100),
      journal: journal?.slice(0, 300),
      volume: meta(["citation_volume", "prism.volume"])?.slice(0, 50),
      issue: meta(["citation_issue", "prism.number"])?.slice(0, 50),
      pages: (meta(["citation_pages", "prism.pageRange"]) || pageRange)?.slice(0, 80),
      doi: doiValue?.slice(0, 200),
      rawText: clean(body).slice(0, 200000),
    });
  });
}