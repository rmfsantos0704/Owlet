// Splits a clip's text into passages and picks the ones most relevant to a question,
// so the AI reads the right parts of long documents instead of just the first few thousand characters.

export type Passage = { n: number; text: string };

const STOP = new Set(
  ("the and for that with this from are was were have has had not but you your they their them been being which who whom " +
    "what when where while about into over under than then also can could would should may might will shall such these " +
    "those its our out any all each other more most some only both between through during before after above below again " +
    "further once here there how why does did doing just very").split(" ")
);

const WORD = /[\p{L}\p{N}]{3,}/gu;

export function terms(query: string): string[] {
  return [...new Set((query.toLowerCase().match(WORD) ?? []).filter((w) => !STOP.has(w)))];
}

const RELATED_STOP = new Set(
  (
    "a about above after again against all also although among an and any are as at be because been before being below between both but by " +
    "can could did do does doing down during each either even few for from further had has have having he her here hers him his how however i if in into is it its itself " +
    "just like many may me might more most much my no nor not now of off on once one only or other our out over own per same shall she should since so some such than that the their theirs them then there therefore these they this those though three through thus to too two under until up upon us use used using very via was we were what when whether which while who whom why will with within without would yet you your yours " +
    "first second new said says still http https www com org net html"
  ).split(" ")
);
const RELATED_WORD = /\p{L}[\p{L}\p{N}'’-]*/gu;

function relatedWords(text: string): string[] {
  const out: string[] = [];
  for (const match of text.toLowerCase().matchAll(RELATED_WORD)) {
    const word = match[0].replace(/['’]s$/, "").replace(/['’-]+$/, "");
    if (word) out.push(word);
  }
  return out;
}

function relatedSingular(word: string) {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && word.endsWith("s") && !/(ss|us|is|ics)$/.test(word)) return word.slice(0, -1);
  return word;
}

export function keyTerms(text: string, max = 8): string[] {
  const stats = new Map<string, { count: number; first: number; phrase: boolean }>();
  let position = 0;
  const bump = (term: string, phrase: boolean) => {
    const current = stats.get(term);
    if (current) current.count++;
    else stats.set(term, { count: 1, first: position, phrase });
  };
  for (const chunk of text.split(/[.!?,\n;:()\[\]"“”]+/)) {
    let previous = "";
    for (const raw of relatedWords(chunk)) {
      position++;
      if (raw.length < 4 || raw.length > 30 || RELATED_STOP.has(raw)) {
        previous = "";
        continue;
      }
      const word = relatedSingular(raw);
      bump(word, false);
      if (previous) bump(`${previous} ${word}`, true);
      previous = word;
    }
  }
  let singles = 0;
  for (const stat of stats.values()) if (!stat.phrase) singles += stat.count;
  const minimum = singles < 400 ? 1 : 2;
  const ranked = [...stats.entries()]
    .filter(([, stat]) => stat.count >= minimum && (!stat.phrase || stat.count >= 2))
    .map(([term, stat]) => ({ term, stat, score: stat.count * (stat.phrase ? 1.6 : 1) }))
    .sort((a, b) => b.score - a.score || a.stat.first - b.stat.first);
  const pool = ranked.slice(0, max * 3).map((entry) => entry.term);
  const phrases = pool.filter((term) => term.includes(" "));
  return pool
    .filter((term) =>
      term.includes(" ") ||
      !phrases.some((phrase) => phrase.split(" ").includes(term) && stats.get(phrase)!.count * 1.5 >= stats.get(term)!.count)
    )
    .slice(0, max);
}

// ~900-character passages that break on paragraph and sentence boundaries
export function chunk(text: string, size = 900): string[] {
  const pieces = text
    .replace(/\r/g, "")
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: string[] = [];
  let cur = "";
  for (const p of pieces) {
    if (p.length > size * 1.5) {
      // run-on text with no sentence breaks: cut it up
      if (cur) out.push(cur);
      cur = "";
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
      continue;
    }
    if (cur && cur.length + p.length + 1 > size) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur} ${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.length >= 40);
}

// Up to `max` passages, scored by how well they match the query (TF-IDF within the document).
// With no useful query, or too few matches, the rest is filled with evenly spaced passages (intro to conclusion).
// `n` is the passage's position in the document, so the same passage always has the same number.
export function pickPassages(text: string, query: string, max: number): Passage[] {
  const chunks = chunk(text);
  if (chunks.length <= max) return chunks.map((t, i) => ({ n: i + 1, text: t }));

  const qs = terms(query);
  const tokens: string[][] = chunks.map((c) => Array.from(c.toLowerCase().match(WORD) ?? []));

  const picked: number[] = [];
  if (qs.length) {
    const df = new Map<string, number>(qs.map((t) => [t, tokens.filter((tk) => tk.includes(t)).length]));
    const scored = tokens
      .map((tk, i) => {
        let score = 0;
        for (const t of qs) {
          const tf = tk.filter((w) => w === t).length;
          if (tf) score += (1 + Math.log(tf)) * Math.log(1 + chunks.length / (1 + (df.get(t) ?? 0)));
        }
        return [score, i] as const;
      })
      .filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of scored.slice(0, max)) picked.push(i);
  }

  if (picked.length < max) {
    const have = new Set(picked);
    for (let k = 0; k < max && have.size < max; k++) {
      const i = Math.round((k * (chunks.length - 1)) / (max - 1));
      if (!have.has(i)) {
        have.add(i);
        picked.push(i);
      }
    }
  }

  return picked
    .slice(0, max)
    .sort((a, b) => a - b)
    .map((i) => ({ n: i + 1, text: chunks[i] }));
}