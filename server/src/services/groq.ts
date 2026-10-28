const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type AiSettings = { format: string; length: string; instructions: string };

const FORMATS: Record<string, string> = {
  paragraph: "one cohesive paragraph",
  bullets: 'bullet points, one per line, each starting with "- "',
  academic:
    'labeled lines in this order: "Research question:", "Approach:", "Key findings:", "Limitations:" (write "Not stated" when the text does not say)',
  simple: "plain, jargon-free language a high-school student could follow",
};

const LENGTHS: Record<string, string> = {
  short: "about 2-3 sentences (or 3 bullets)",
  medium: "about 4-6 sentences (or 4-6 bullets)",
  detailed: "about 8-10 sentences (or 8-10 bullets)",
};

// gpt-oss models "think" before answering, and that thinking counts against the completion limit.
// Without a generous limit and low reasoning effort, the JSON gets cut off mid-way and Groq returns a 400.
function modelParams(maxTokens: number) {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  return {
    model,
    max_completion_tokens: maxTokens,
    ...(model.includes("gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
  };
}

export async function analyzeText(title: string, text: string, settings: Partial<AiSettings> = {}) {
  const format = FORMATS[settings.format ?? ""] ?? FORMATS.paragraph;
  const length = LENGTHS[settings.length ?? ""] ?? LENGTHS.medium;
  const extra = settings.instructions?.trim();

  const system =
    `You are a research assistant. Respond ONLY with JSON: {"summary": string, "paraphrase": string, "tags": string[]}.\n` +
    `- summary: ${format}; length ${length}. Separate lines with \\n.\n` +
    `- paraphrase: the key arguments restated in your own words, one short paragraph.\n` +
    `- tags: 3-5 lowercase topic tags.\n` +
    `- Use only information found in the text. Never invent facts; if something is not stated, say so.` +
    (extra
      ? `\nThe user added the instructions below. Follow them when writing the summary, paraphrase and tags, but never change the JSON structure above and never write anything outside the JSON.\n"""${extra}"""`
      : "");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      ...modelParams(4096),
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Title: ${title}\n\n${text.slice(0, 12000)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const parsed = JSON.parse(data.choices[0].message.content);
  return {
    summary: String(parsed.summary ?? ""),
    paraphrase: String(parsed.paraphrase ?? ""),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 5) : [],
  };
}

// ---- AI workspace: answer across several saved sources, with quoted evidence ----

const MODES: Record<string, string> = {
  "Research brief":
    "Write a research brief: an executive summary, then 3-5 key findings, noting agreements, gaps and open questions.",
  Summarize: "Summarize the sources: a short overall summary, then one finding per source or theme.",
  "Compare sources": "Compare the sources: where they agree, where they disagree, and how their methods or claims differ.",
};

export type AskSource = { title: string; passages: { n: number; text: string }[] };
export type Evidence = { source: number; quote: string; verified: boolean };
export type Finding = { title: string; text: string; sources: number[]; evidence: Evidence[] };

const norm = (s: string) =>
  s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const excerpt = (s: string, n = 240) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

export async function askSources(mode: string, question: string, sources: AskSource[]) {
  const focus = question.trim();
  const system =
    `You are a research assistant. Respond ONLY with JSON: {"summary": string, "findings": [{"title": string, "text": string, "sources": number[], "evidence": [{"source": number, "passage": number, "quote": string}]}]}.\n` +
    `- ${MODES[mode] ?? MODES["Research brief"]}\n` +
    `- The sources are given as numbered passages. A label like (2:5) means source 2, passage 5.\n` +
    `- "sources" holds the numbers of the sources that support each finding.\n` +
    `- "evidence": 1-3 items per finding. "source" and "passage" are the numbers from the passage label. "quote" must be copied exactly, word for word, from that passage (at most 40 words). Never alter, shorten with "..." or join quotes.\n` +
    `- Use only information found in the passages. Never invent facts; if the passages do not say something, say so.\n` +
    `- You only see selected passages of each source, not its whole text. Do not claim a source says nothing about a topic just because it is absent from these passages.` +
    (focus
      ? `\nThe user added the question or focus below. Follow it, but never change the JSON structure above and never write anything outside the JSON.\n"""${focus}"""`
      : "");

  const body = sources
    .map((s, i) => `[${i + 1}] ${s.title}\n` + s.passages.map((p) => `(${i + 1}:${p.n}) ${p.text}`).join("\n\n"))
    .join("\n\n=====\n\n");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      // findings + quoted evidence make this a long answer, so it gets a bigger budget than analyzeText
      ...modelParams(8192),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: body },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const parsed = JSON.parse(data.choices[0].message.content);

  const valid = (n: unknown) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= sources.length;

  const findings: Finding[] = (Array.isArray(parsed.findings) ? parsed.findings : []).slice(0, 8).map((f: any) => {
    const evidence: Evidence[] = [];
    for (const e of (Array.isArray(f.evidence) ? f.evidence : []).slice(0, 3)) {
      if (!valid(e?.source)) continue;
      const passage = sources[Number(e.source) - 1].passages.find((p) => p.n === Number(e.passage));
      if (!passage) continue;
      const quote = String(e.quote ?? "").trim();
      // only keep the model's wording when it really appears in that passage; otherwise show the passage itself
      const verified = quote.length >= 15 && norm(passage.text).includes(norm(quote));
      evidence.push({ source: Number(e.source), quote: verified ? quote : excerpt(passage.text), verified });
    }
    const cited = (Array.isArray(f.sources) ? f.sources : []).filter(valid).map(Number);
    return {
      title: String(f.title ?? ""),
      text: String(f.text ?? ""),
      sources: [...new Set([...cited, ...evidence.map((e) => e.source)])],
      evidence,
    };
  });

  return { summary: String(parsed.summary ?? ""), findings };
}