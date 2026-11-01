type Meta = {
  author?: string;
  authors?: string[];
  title: string;
  url?: string;
  domain?: string;
  publishedDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const ORG = /\b(contributors?|team|staff|editors?|editorial|inc|llc|ltd|corp|university|institute|association|foundation|department|committee|council|society|group|board|agency)\b/i;

export function splitName(author: string) {
  const a = author.trim();
  const parts = a.split(/\s+/);
  const raw =
    /;| and | & /i.test(a) || parts.length < 2 || parts.length > 4 || ORG.test(a) || /\d/.test(a);
  if (raw) return { last: a, first: "", raw: true };
  if (a.includes(",")) {
    const [last, ...first] = a.split(",");
    return { last: last.trim(), first: first.join(",").trim(), raw: false };
  }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" "), raw: false };
}

function authorList(m: Meta) {
  const names = m.authors?.length ? m.authors : m.author ? m.author.split(/\s*;\s*/).filter(Boolean) : [];
  return names.map((name) => splitName(name));
}

function apaAuthors(authors: ReturnType<typeof authorList>) {
  const list = authors.length > 20 ? [...authors.slice(0, 19), authors[authors.length - 1]] : authors;
  const formatted = list.map((a) =>
    a.raw ? a.last.replace(/\.?$/, ".") : `${a.last}, ${a.first.split(/\s+/).filter(Boolean).map((n) => n[0] + ".").join(" ")}`
  );
  if (authors.length > 20) formatted.splice(19, 0, "…");
  if (formatted.length > 1) return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  return formatted[0] ?? "";
}

function mlaAuthors(authors: ReturnType<typeof authorList>) {
  if (!authors.length) return "";
  const name = (a: ReturnType<typeof authorList>[number]) => a.raw ? a.last : `${a.last}, ${a.first}`;
  if (authors.length === 1) return `${name(authors[0])}. `;
  if (authors.length === 2) {
    const second = authors[1].raw ? authors[1].last : `${authors[1].first} ${authors[1].last}`;
    return `${name(authors[0])}, and ${second}. `;
  }
  return `${name(authors[0])}, et al. `;
}

function chicagoAuthors(authors: ReturnType<typeof authorList>) {
  if (!authors.length) return "";
  const name = (a: ReturnType<typeof authorList>[number]) => a.raw ? a.last : `${a.last}, ${a.first}`;
  if (authors.length === 1) return `${name(authors[0])}. `;
  if (authors.length === 2) {
    const second = authors[1].raw ? authors[1].last : `${authors[1].first} ${authors[1].last}`;
    return `${name(authors[0])}, and ${second}. `;
  }
  return `${name(authors[0])}, et al. `;
}

function doiUrl(doi?: string) {
  const value = doi?.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return value ? `https://doi.org/${value}` : "";
}

export function buildCitations(m: Meta) {
  const isFile = !m.url;
  const site = m.domain ? m.domain.replace(/^www\./, "") : "";
  const d = parseDate(m.publishedDate);
  const rawDate = (m.publishedDate ?? "").trim();
  const yearOnly = /^\d{4}$/.test(rawDate);
  const year = yearOnly ? rawDate : d?.getUTCFullYear();
  const authors = authorList(m);
  const apaDate = d ? (yearOnly ? rawDate : `${year}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`) : "n.d.";
  const mlaDate = d ? (yearOnly ? rawDate : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}. ${year}`) : "";
  const chiDate = d ? (yearOnly ? `${year}.` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${year}.`) : "";
  const journal = m.journal?.trim();
  const pages = m.pages?.trim();
  const volume = m.volume?.trim();
  const issue = m.issue?.trim();
  const doi = doiUrl(m.doi);
  const isJournalArticle = !!journal;

  const apaJournalDetails = [
    volume ? `${volume}${issue ? `(${issue})` : ""}` : "",
    pages ? pages : "",
  ].filter(Boolean).join(", ");
  const formattedApaAuthors = apaAuthors(authors);
  const apa = isJournalArticle
    ? `${formattedApaAuthors ? `${formattedApaAuthors} (${apaDate}). ${m.title}.` : `${m.title}. (${apaDate}).`} ${journal}${apaJournalDetails ? `, ${apaJournalDetails}` : ""}.${doi ? ` ${doi}` : ""}`
    : isFile
      ? `${formattedApaAuthors ? `${formattedApaAuthors} (${apaDate}). ${m.title} [PDF].` : `${m.title} [PDF]. (${apaDate}).`}`
      : `${formattedApaAuthors ? `${formattedApaAuthors} (${apaDate}). ${m.title}.` : `${m.title}. (${apaDate}).`} ${site}. ${doi || m.url}`;

  const mlaJournalDetails = [
    volume ? `vol. ${volume}` : "",
    issue ? `no. ${issue}` : "",
    mlaDate,
    pages ? `pp. ${pages}` : "",
  ].filter(Boolean).join(", ");
  const mla = isJournalArticle
    ? `${mlaAuthors(authors)}"${m.title}." ${journal}${mlaJournalDetails ? `, ${mlaJournalDetails}` : ""}${doi ? `, ${doi}` : ""}.`
    : isFile
      ? `${mlaAuthors(authors)}"${m.title}."${mlaDate ? ` ${mlaDate}.` : ""} PDF file.`
      : `${mlaAuthors(authors)}"${m.title}." ${site}${mlaDate ? `, ${mlaDate}` : ""}, ${doi || m.url}.`;

  const chicagoJournalDetails = [
    volume ? `${volume}${issue ? `, no. ${issue}` : ""}${d ? ` (${year})` : ""}` : "",
    !volume && d ? String(year) : "",
  ].filter(Boolean).join("") + (pages ? `: ${pages}` : "");
  const chicago = isJournalArticle
    ? `${chicagoAuthors(authors)}"${m.title}." ${journal}${chicagoJournalDetails ? ` ${chicagoJournalDetails}` : ""}.${doi ? ` ${doi}` : ""}.`
    : isFile
      ? `${chicagoAuthors(authors)}"${m.title}."${chiDate ? ` ${chiDate}` : ""} PDF file.`
      : `${chicagoAuthors(authors)}"${m.title}." ${site}.${chiDate ? ` ${chiDate}` : ""} ${doi || m.url}.`;

  return { apa, mla, chicago };
}
