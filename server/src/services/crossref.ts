type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: { family?: string; given?: string; name?: string }[];
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  "article-number"?: string;
  published?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
};

type CrossrefResponse = { message?: CrossrefWork };

export type CitationMetadata = {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
};

function normalizeDoi(value?: string) {
  const doi = value
    ?.trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[.,;]+$/, "");
  return doi && /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : undefined;
}

function publicationDate(work: CrossrefWork) {
  const parts =
    work["published-print"]?.["date-parts"]?.[0] ??
    work.published?.["date-parts"]?.[0] ??
    work["published-online"]?.["date-parts"]?.[0] ??
    work.issued?.["date-parts"]?.[0];
  if (!parts?.length || !Number.isInteger(parts[0])) return undefined;
  const [year, month, day] = parts;
  if (month && day) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (month) return `${year}-${String(month).padStart(2, "0")}`;
  return String(year);
}

export async function lookupCrossref(doiValue?: string): Promise<CitationMetadata | null> {
  const doi = normalizeDoi(doiValue);
  if (!doi) return null;

  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { Accept: "application/json", "User-Agent": "Owlet citation metadata lookup" },
    signal: AbortSignal.timeout(3000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}`);

  const payload = (await response.json()) as CrossrefResponse;
  const work = payload.message;
  if (!work) return null;
  const authors = work.author
    ?.map((author) => author.name?.trim() || [author.given, author.family].filter(Boolean).join(" ").trim())
    .filter(Boolean);

  return {
    title: work.title?.[0]?.trim() || undefined,
    authors: authors?.length ? authors : undefined,
    publishedDate: publicationDate(work),
    journal: work["container-title"]?.[0]?.trim() || undefined,
    volume: work.volume?.trim() || undefined,
    issue: work.issue?.trim() || undefined,
    pages: work.page?.trim() || work["article-number"]?.trim() || undefined,
    doi: work.DOI || doi,
  };
}
