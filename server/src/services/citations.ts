type Meta = {
  author?: string;
  title: string;
  url?: string; // missing for imported PDFs
  domain?: string;
  publishedDate?: string;
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
    /,|;| and | & /i.test(a) || parts.length < 2 || parts.length > 4 || ORG.test(a) || /\d/.test(a);
  if (raw) return { last: a, first: "", raw: true };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" "), raw: false };
}

export function buildCitations(m: Meta) {
  const isFile = !m.url;
  const site = m.domain ? m.domain.replace(/^www\./, "") : "";
  const d = parseDate(m.publishedDate);
  const yearOnly = /^\d{4}$/.test((m.publishedDate ?? "").trim());
  const a = m.author ? splitName(m.author) : null;

  // APA
  const apaDate = d ? (yearOnly ? `${d.getFullYear()}` : `${d.getFullYear()}, ${MONTHS[d.getMonth()]} ${d.getDate()}`) : "n.d.";
  const apaAuthor = a
    ? a.raw
      ? a.last.replace(/\.?$/, ".")
      : `${a.last}, ${a.first.split(" ").map((n) => n[0] + ".").join(" ")}`
    : null;
  const apa = isFile
    ? apaAuthor
      ? `${apaAuthor} (${apaDate}). ${m.title} [PDF].`
      : `${m.title} [PDF]. (${apaDate}).`
    : apaAuthor
      ? `${apaAuthor} (${apaDate}). ${m.title}. ${site}. ${m.url}`
      : `${m.title}. (${apaDate}). ${site}. ${m.url}`;

  // MLA
  const mlaDate = d ? (yearOnly ? `${d.getFullYear()}` : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}. ${d.getFullYear()}`) : "";
  const mlaAuthor = a ? (a.raw ? a.last : `${a.last}, ${a.first}`) + ". " : "";
  const mla = isFile
    ? `${mlaAuthor}"${m.title}."${mlaDate ? " " + mlaDate + "." : ""} PDF file.`
    : `${mlaAuthor}"${m.title}." ${site}${mlaDate ? ", " + mlaDate : ""}, ${m.url}.`;

  // Chicago
  const chiDate = d ? (yearOnly ? ` ${d.getFullYear()}.` : ` ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}.`) : "";
  const chiAuthor = a ? (a.raw ? a.last : `${a.last}, ${a.first}`) + ". " : "";
  const chicago = isFile
    ? `${chiAuthor}"${m.title}."${chiDate} PDF file.`
    : `${chiAuthor}"${m.title}." ${site}.${chiDate} ${m.url}.`;

  return { apa, mla, chicago };
}