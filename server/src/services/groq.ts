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
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
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