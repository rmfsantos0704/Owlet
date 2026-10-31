// Plain text analysis that runs in the browser: no network calls and no AI.
// It ranks sentences and words that are already in the text. It never writes new text.

const STOP = new Set(
  (
    "a about above after again against all also although among an and any are as at be because been before being below between both but by " +
    "can could did do does doing down during each either even few for from further had has have having he her here hers him his how however i if in into is it its itself " +
    "just like many may me might more most much my no nor not now of off on once one only or other our out over own per same shall she should since so some such than that the their theirs them then there therefore these they this those though three through thus to too two under until up upon us use used using very via was we were what when where whether which while who whom why will with within without would yet you your yours " +
    "first second new said says still http https www com org net html"
  ).split(" ")
);

const WORD = /\p{L}[\p{L}\p{N}'’-]*/gu;

function words(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(WORD)) {
    const w = m[0].replace(/['’]s$/, "").replace(/['’-]+$/, "");
    if (w) out.push(w);
  }
  return out;
}

const isTerm = (w: string) => w.length >= 4 && w.length <= 30 && !STOP.has(w);

// "memories" -> "memory", "students" -> "student"; leaves words like "analysis" and "class" alone
function singular(w: string) {
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("s") && !/(ss|us|is|ics)$/.test(w)) return w.slice(0, -1);
  return w;
}

// ---------- sentences ----------

const ABBREV = /\b(?:e\.g|i\.e|et al|vs|cf|etc|fig|figs|dr|mr|mrs|ms|prof|inc|ltd|approx)\.$/i;
const BOILERPLATE =
  /\b(cookies?|subscribe|newsletter|sign up|log in|all rights reserved|copyright|click here|privacy policy|terms of (?:use|service)|advertisement|share this|follow us)\b/i;

function usable(s: string) {
  if (s.length < 40 || s.length > 420) return false;
  if (s.split(" ").length < 7) return false;
  if (BOILERPLATE.test(s)) return false;
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  return letters / s.length >= 0.65; // skips tables, reference lists and the like
}

function sentences(text: string): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split(/\n+/)) {
    const pieces = para
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?]["”')\]]?)\s+(?=["“'(\[]?[\p{Lu}\p{N}])/u);
    let carry = "";
    for (const piece of pieces) {
      const s = carry ? `${carry} ${piece}` : piece;
      if (ABBREV.test(s)) {
        carry = s; // "et al." and friends are not the end of a sentence
        continue;
      }
      carry = "";
      out.push(s.trim());
    }
    if (carry) out.push(carry.trim());
  }
  return out.filter(usable);
}

// The sentences that carry the most of the text's repeated vocabulary, in the order they appear.
export function keySentences(text: string, count = 5): string[] {
  const sents = sentences(text);
  if (sents.length <= count) return sents;

  const tokens = sents.map((s) => words(s).filter(isTerm).map(singular));
  const tf = new Map<string, number>();
  for (const ts of tokens) for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
  let maxTf = 1;
  for (const n of tf.values()) if (n > maxTf) maxTf = n;

  const scored = tokens.map((ts, i) => {
    const uniq = new Set(ts);
    let sum = 0;
    for (const t of uniq) {
      const f = tf.get(t)!;
      if (f > 1) sum += f / maxTf; // words used once say little about the main topic
    }
    let score = sum / Math.sqrt(Math.max(uniq.size, 6)); // reward dense sentences, not just long ones
    if (i < 3) score *= 1.2; // opening sentences usually frame the piece
    if (i >= sents.length - 3) score *= 1.1; // so do closing ones
    return { i, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: number[] = [];
  const covered = new Set<string>();
  // first pass skips sentences that mostly repeat what was already picked
  for (const { i } of scored) {
    if (picked.length >= count) break;
    const ts = new Set(tokens[i]);
    let overlap = 0;
    for (const t of ts) if (covered.has(t)) overlap++;
    if (ts.size && overlap / ts.size > 0.6) continue;
    picked.push(i);
    for (const t of ts) covered.add(t);
  }
  // second pass fills any gap with the next best
  for (const { i } of scored) {
    if (picked.length >= count) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return picked.sort((a, b) => a - b).map((i) => sents[i]);
}

// ---------- terms ----------

type Stat = { count: number; first: number; n: 1 | 2 };

// single words and two-word phrases, counted; a stop word or punctuation breaks a phrase
function termStats(text: string): Map<string, Stat> {
  const stats = new Map<string, Stat>();
  let pos = 0;
  const bump = (term: string, n: 1 | 2) => {
    const s = stats.get(term);
    if (s) s.count++;
    else stats.set(term, { count: 1, first: pos, n });
  };
  for (const chunk of text.split(/[.!?,\n;:()\[\]"“”]+/)) {
    let prev = "";
    for (const raw of words(chunk)) {
      pos++;
      if (!isTerm(raw)) {
        prev = "";
        continue;
      }
      const w = singular(raw);
      bump(w, 1);
      if (prev) bump(`${prev} ${w}`, 2);
      prev = w;
    }
  }
  return stats;
}

// Words and phrases worth suggesting as tags (lowercase, never longer than 30 characters).
export function keyTerms(text: string, max = 10): string[] {
  const stats = termStats(text);
  let singles = 0;
  for (const s of stats.values()) if (s.n === 1) singles += s.count;
  const min = singles < 400 ? 1 : 2; // short texts have few repeats

  const ranked = [...stats.entries()]
    .filter(([, s]) => s.count >= min && (s.n === 1 || s.count >= 2))
    .map(([term, s]) => ({ term, s, score: s.count * (s.n === 2 ? 1.6 : 1) }))
    .sort((a, b) => b.score - a.score || a.s.first - b.s.first);

  const pool = ranked.slice(0, max * 3).map((r) => r.term);
  const phrases = pool.filter((t) => t.includes(" "));
  // a single word is dropped when a chosen phrase containing it almost always covers it
  return pool
    .filter(
      (t) =>
        t.includes(" ") ||
        !phrases.some((p) => p.split(" ").includes(t) && stats.get(p)!.count * 1.5 >= stats.get(t)!.count)
    )
    .slice(0, max);
}

// Words and phrases that show up in more than one of the given texts; count = how many texts have it.
export function recurringTerms(texts: string[], max = 12): { term: string; count: number }[] {
  if (texts.length < 2) return [];
  const docs = new Map<string, { df: number; total: number }>();
  for (const t of texts) {
    for (const [term, s] of termStats(t)) {
      const d = docs.get(term);
      if (d) {
        d.df++;
        d.total += s.count;
      } else docs.set(term, { df: 1, total: s.count });
    }
  }
  const rows = [...docs.entries()]
    .filter(([, d]) => d.df >= 2)
    .map(([term, d]) => ({ term, ...d }))
    .sort((a, b) => b.df - a.df || b.total - a.total);

  const phrases = rows.filter((r) => r.term.includes(" "));
  return rows
    .filter((r) => r.term.includes(" ") || !phrases.some((p) => p.term.split(" ").includes(r.term) && p.df >= r.df))
    .slice(0, max)
    .map((r) => ({ term: r.term, count: r.df }));
}