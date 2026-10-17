type Meta = {
  author?: string;
  title: string;
  url: string;
  domain: string;
  publishedDate?: string;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function parseDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function splitName(author: string) {
  const multi = /,| and | & /i.test(author);
  const parts = author.trim().split(/\s+/);
  if (multi || parts.length < 2) return { last: author.trim(), first: "", raw: true };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" "), raw: false };
}

export function buildCitations(m: Meta) {
  const site = m.domain.replace(/^www\./, "");
  const d = parseDate(m.publishedDate);
  const a = m.author ? splitName(m.author) : null;

  // APA
  const apaDate = d ? `${d.getFullYear()}, ${MONTHS[d.getMonth()]} ${d.getDate()}` : "n.d.";
  const apaAuthor = a ? (a.raw ? a.last : `${a.last}, ${a.first.split(" ").map((n) => n[0] + ".").join(" ")}`) : null;
  const apa = apaAuthor
    ? `${apaAuthor} (${apaDate}). ${m.title}. ${site}. ${m.url}`
    : `${m.title}. (${apaDate}). ${site}. ${m.url}`;

  // MLA
  const mlaDate = d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}. ${d.getFullYear()}` : "";
  const mlaAuthor = a ? (a.raw ? a.last : `${a.last}, ${a.first}`) + ". " : "";
  const mla = `${mlaAuthor}"${m.title}." ${site}${mlaDate ? ", " + mlaDate : ""}, ${m.url}.`;

  // Chicago
  const chiDate = d ? ` ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}.` : "";
  const chiAuthor = a ? (a.raw ? a.last : `${a.last}, ${a.first}`) + ". " : "";
  const chicago = `${chiAuthor}"${m.title}." ${site}.${chiDate} ${m.url}.`;

  return { apa, mla, chicago };
}