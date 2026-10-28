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
  const tokens = chunks.map((c) => c.toLowerCase().match(WORD) ?? []);

  const picked: number[] = [];
  if (qs.length) {
    const df = new Map(qs.map((t) => [t, tokens.filter((tk) => tk.includes(t)).length]));
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