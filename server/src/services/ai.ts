import { reserveAiGeneration } from "./aiUsage.js";

type Provider = {
  name: string;
  url: string;
  apiKey: string;
  model: string;
  tokenParameter: "max_tokens" | "max_completion_tokens";
  jsonMode: boolean;
};

type ProviderFailure = { provider: string; reason: string };
type Message = { role: "system" | "user"; content: string };

export class AiProvidersError extends Error {
  constructor(readonly failures: ProviderFailure[]) {
    super("All configured AI providers failed.");
    this.name = "AiProvidersError";
  }
}

function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    providers.push({
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model,
      tokenParameter: "max_completion_tokens",
      jsonMode: true,
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && process.env.GEMINI_MODEL) {
    providers.push({
      name: "Gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL,
      tokenParameter: "max_tokens",
      jsonMode: false,
    });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel = process.env.OPENROUTER_MODEL;
  if (openRouterKey && openRouterModel) {
    providers.push({
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openRouterKey,
      model: openRouterModel,
      tokenParameter: "max_tokens",
      jsonMode: true,
    });
  }
  return providers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function completionContent(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.choices)) return undefined;
  const first = data.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return undefined;
  return typeof first.message.content === "string" ? first.message.content : undefined;
}

async function completeJson(
  userId: string,
  messages: Message[],
  maxTokens: number,
  temperature: number
): Promise<Record<string, unknown>> {
  await reserveAiGeneration(userId);
  const providers = configuredProviders();
  const failures: ProviderFailure[] = [];
  const deadline = Date.now() + 45_000;
  if (!providers.length) {
    throw new AiProvidersError([{ provider: "configuration", reason: "No AI providers are configured" }]);
  }

  for (const provider of providers) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      failures.push({ provider: "fallback", reason: "Total provider timeout reached" });
      break;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(15_000, remaining));
    try {
      const tokenLimit =
        provider.tokenParameter === "max_completion_tokens"
          ? { max_completion_tokens: maxTokens }
          : { max_tokens: maxTokens };
      const groqReasoning =
        provider.name === "Groq" && provider.model.includes("gpt-oss")
          ? { reasoning_effort: "low", include_reasoning: false }
          : {};
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider.model,
          ...tokenLimit,
          ...groqReasoning,
          temperature,
          ...(provider.jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages,
        }),
      });

      if (!response.ok) {
        failures.push({ provider: provider.name, reason: `HTTP ${response.status}` });
        continue;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        failures.push({ provider: provider.name, reason: "Invalid API response" });
        continue;
      }

      const content = completionContent(data);
      if (!content) {
        failures.push({ provider: provider.name, reason: "Missing completion content" });
        continue;
      }

      try {
        const parsed: unknown = JSON.parse(content);
        if (isRecord(parsed)) return parsed;
        failures.push({ provider: provider.name, reason: "Completion was not a JSON object" });
      } catch {
        failures.push({ provider: provider.name, reason: "Completion was not valid JSON" });
      }
    } catch (error) {
      failures.push({
        provider: provider.name,
        reason: error instanceof Error && error.name === "AbortError" ? "Request timed out" : "Network error",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AiProvidersError(failures);
}

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
  detailed: "about 12-16 sentences (or 12-16 bullets), with enough detail to cover the source's important points",
};

export async function analyzeText(
  userId: string,
  title: string,
  text: string,
  settings: Partial<AiSettings> = {}
): Promise<{ summary: string; paraphrase: string; tags: string[] }> {
  const format = FORMATS[settings.format ?? ""] ?? FORMATS.paragraph;
  const length = LENGTHS[settings.length ?? ""] ?? LENGTHS.medium;
  const extra = settings.instructions?.trim();

  const system =
    `You are a research assistant. Respond ONLY with JSON: {"summary": string, "paraphrase": string, "tags": string[]}.\n` +
    (extra
      ? `\nTOP PRIORITY: the user's instructions below. Build the summary, paraphrase and tags around them. ` +
        `If they name a section or topic (for example "the objective" or "the methods"), base the summary mainly on that part of the text and mention other parts only briefly, or not at all. ` +
        `Never change the JSON structure and never write anything outside the JSON.\n"""${extra}"""\n\n`
      : "\n") +
    `- summary: ${format}; length ${length}. Separate lines with \\n. Do not impose an 8-line limit on detailed summaries.\n` +
    `- paraphrase: ${extra ? "the key points of the user's focus above" : "the key arguments"} restated in your own words, one short paragraph.\n` +
    `- tags: 3-5 lowercase topic tags.\n` +
    `- Use only information found in the text. Never invent facts; if something is not stated, say so.`;

  const parsed = await completeJson(
    userId,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Title: ${title}\n\n${text.slice(0, 12000)}` +
          (extra ? `\n\n---\nReminder: follow the user's instructions for the summary, paraphrase and tags:\n"""${extra}"""` : ""),
      },
    ],
    4096,
    0.3
  );
  return {
    summary: String(parsed.summary ?? ""),
    paraphrase: String(parsed.paraphrase ?? ""),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag: unknown) => String(tag).toLowerCase().trim().slice(0, 40)).filter(Boolean).slice(0, 5)
      : [],
  };
}

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

export async function askSources(userId: string, mode: string, question: string, sources: AskSource[]) {
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
    .map((source, i) => `[${i + 1}] ${source.title}\n` + source.passages.map((passage) => `(${i + 1}:${passage.n}) ${passage.text}`).join("\n\n"))
    .join("\n\n=====\n\n");
  const parsed = await completeJson(
    userId,
    [
      { role: "system", content: system },
      { role: "user", content: body },
    ],
    8192,
    0.2
  );

  const valid = (n: unknown) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= sources.length;
  const findings: Finding[] = (Array.isArray(parsed.findings) ? parsed.findings : [])
    .slice(0, 8)
    .map((value: unknown) => {
      const finding = isRecord(value) ? value : {};
      const evidence: Evidence[] = [];
      const entries = Array.isArray(finding.evidence) ? finding.evidence.slice(0, 3) : [];
      for (const entry of entries) {
        const item = isRecord(entry) ? entry : {};
        if (!valid(item.source)) continue;
        const passage = sources[Number(item.source) - 1].passages.find((p) => p.n === Number(item.passage));
        if (!passage) continue;
        const quote = String(item.quote ?? "").trim();
        const verified = quote.length >= 15 && norm(passage.text).includes(norm(quote));
        evidence.push({ source: Number(item.source), quote: verified ? quote : excerpt(passage.text), verified });
      }
      const cited = (Array.isArray(finding.sources) ? finding.sources : []).filter(valid).map(Number);
      return {
        title: String(finding.title ?? ""),
        text: String(finding.text ?? ""),
        sources: [...new Set([...cited, ...evidence.map((item) => item.source)])],
        evidence,
      };
    });

  return { summary: String(parsed.summary ?? ""), findings };
}

// ---------- research briefs ----------

export type BriefSource = { title: string; passages: { n: number; text: string }[] };
export type BriefEvidence = { source: number; passage: number; quote: string; verified: boolean };
export type BriefDraft = { sections: { title: string; blocks: { text: string; evidence: BriefEvidence[] }[] }[] };
export type BriefSpec = {
  label: string;
  instruction: string;
  sections: string[] | null; // null = one section per source
  question: string;
  context: string; // how the researcher organized the evidence, if they chose to share the board
};

// Writes a structured brief from numbered passages. Every block must carry quotes from the passages,
// and each quote is checked word for word against the passage it names.
export async function composeBrief(userId: string, spec: BriefSpec, sources: BriefSource[]): Promise<BriefDraft> {
  const layout = spec.sections
    ? `Write exactly these sections, in this order: ${spec.sections.map((t) => `"${t}"`).join(", ")}.`
    : `Write one section per source, in source order (${sources.length} sections). Use the source's title as the section title.`;
  const system =
    `You are a research writing assistant. Respond ONLY with JSON: {"sections": [{"title": string, "blocks": [{"text": string, "evidence": [{"source": number, "passage": number, "quote": string}]}]}]}.\n` +
    `- ${spec.instruction}\n` +
    `- ${layout}\n` +
    `- Each block is one short paragraph (2-4 sentences). Use 1-4 blocks per section.\n` +
    `- The sources are given as numbered passages. A label like (2:5) means source 2, passage 5.\n` +
    `- Every block MUST have 1-3 "evidence" items that support what the block says. "source" and "passage" are the numbers from the passage label. "quote" must be copied exactly, word for word, from that passage (at most 40 words). Never alter, shorten with "..." or join quotes.\n` +
    `- Use only information found in the passages. Never invent facts. If the passages do not cover a section, write one block that says so and give it an empty "evidence" list.\n` +
    `- You only see selected passages of each source, not its whole text. Do not claim a source says nothing about a topic just because it is absent from these passages.\n` +
    `- Passages numbered 1000-1999 are the researcher's own highlights: they show what the researcher found important, so give them extra weight. Passages numbered 2000 and above are cells from the researcher's literature matrix (a column name and the value they recorded).` +
    (spec.question ? `\nThe research question this brief serves:\n"""${spec.question}"""` : "") +
    (spec.context ? `\nHow the researcher organized their evidence (use it to decide what supports, challenges, or only gives background; never cite it, only cite passages):\n"""${spec.context}"""` : "");

  const body = sources
    .map((source, i) => `[${i + 1}] ${source.title}\n` + source.passages.map((p) => `(${i + 1}:${p.n}) ${p.text}`).join("\n\n"))
    .join("\n\n=====\n\n");

  const parsed = await completeJson(
    userId,
    [
      { role: "system", content: system },
      { role: "user", content: body },
    ],
    8192,
    0.2
  );

  const maxSections = spec.sections ? spec.sections.length : sources.length;
  const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
    .slice(0, maxSections)
    .map((value: unknown) => {
      const section = isRecord(value) ? value : {};
      const blocks = (Array.isArray(section.blocks) ? section.blocks : []).slice(0, 6).map((raw: unknown) => {
        const block = isRecord(raw) ? raw : {};
        const evidence: BriefEvidence[] = [];
        for (const entry of (Array.isArray(block.evidence) ? block.evidence : []).slice(0, 3)) {
          const item = isRecord(entry) ? entry : {};
          const sourceNo = Number(item.source);
          if (!Number.isInteger(sourceNo) || sourceNo < 1 || sourceNo > sources.length) continue;
          const passage = sources[sourceNo - 1].passages.find((p) => p.n === Number(item.passage));
          if (!passage) continue;
          const quote = String(item.quote ?? "").trim();
          const verified = quote.length >= 15 && norm(passage.text).includes(norm(quote));
          evidence.push({ source: sourceNo, passage: passage.n, quote: verified ? quote : excerpt(passage.text), verified });
        }
        return { text: String(block.text ?? "").trim().slice(0, 1500), evidence };
      }).filter((b: { text: string }) => b.text);
      return { title: String(section.title ?? "").trim().slice(0, 200), blocks };
    })
    .filter((s: { blocks: unknown[] }) => s.blocks.length > 0);

  return { sections };
}

// ---------- citation details ----------

export const SOURCE_DETAIL_FIELDS = ["author", "publishedDate", "journal", "volume", "issue", "pages", "doi"] as const;
export type SourceDetailField = (typeof SOURCE_DETAIL_FIELDS)[number];
export type SourceSuggestions = Partial<Record<SourceDetailField, string>>;

// A suggestion is only kept when the passage the AI points to really is in the text and really contains the value.
function detailSupported(field: SourceDetailField, value: string, quote: string, text: string): boolean {
  const nq = norm(quote);
  const nt = norm(text);
  if (!nq || !nt.includes(nq)) return false;
  if (field === "doi") return nt.includes(norm(value));
  const tokens = value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1 || /\d/.test(t));
  return tokens.length > 0 && tokens.every((t) => nq.includes(t));
}

// Reads the start of a clip and proposes the citation details it clearly states. Nothing is guessed:
// every field must come with a passage copied from the text, and fields that fail that check are dropped.
export async function suggestSourceDetails(
  userId: string,
  input: { title: string; text: string; missing: SourceDetailField[] }
): Promise<SourceSuggestions> {
  const text = input.text.slice(0, 6000);
  const system =
    `You read the start of a web page or paper and pull out its citation details. Respond ONLY with JSON: {"fields": {"<field>": {"value": string, "quote": string}}}.\n` +
    `- Fill only these fields: ${input.missing.join(", ")}. Leave out any field the text does not clearly state. Never guess.\n` +
    `- "quote" must be copied exactly, word for word, from the text (at most 30 words) and must contain the value.\n` +
    `- author: the people who wrote it, as written, for example "Jane Smith" or "Jane Smith, John Lee". Never the website or publisher.\n` +
    `- publishedDate: the publication date as written. journal: the journal or publication name. volume, issue, pages: as written. doi: only the DOI, like 10.1234/abcd.`;
  const parsed = await completeJson(
    userId,
    [
      { role: "system", content: system },
      { role: "user", content: `Title: ${input.title}\n\n${text}` },
    ],
    1024,
    0
  );

  const out: SourceSuggestions = {};
  const fields = isRecord(parsed.fields) ? parsed.fields : {};
  for (const field of input.missing) {
    const entry = isRecord(fields[field]) ? (fields[field] as Record<string, unknown>) : null;
    if (!entry) continue;
    const value = String(entry.value ?? "").trim().slice(0, 200);
    const quote = String(entry.quote ?? "").trim();
    if (value && detailSupported(field, value, quote, text)) out[field] = value;
  }
  return out;
}

export async function explainPassage(
  userId: string,
  input: { mode: "explain" | "summarize"; title: string; passage: string; context: string }
): Promise<string> {
  const task =
    input.mode === "explain"
      ? "Explain the selected passage in plain language: what it says, and what any technical terms or abbreviations in it mean. 3-5 sentences."
      : "Summarize the selected passage in 1-2 sentences.";
  const system =
    `You are a research assistant helping someone read a paper. Respond ONLY with JSON: {"answer": string}.\n` +
    `- ${task}\n` +
    `- Use only the selected passage and the text around it. Never invent facts; if the text does not say something, say so.\n` +
    `- Plain text only: no markdown, no bullet symbols.`;
  const parsed = await completeJson(
    userId,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Title: ${input.title}\n\n` +
          (input.context ? `Text around the selection:\n"""${input.context}"""\n\n` : "") +
          `Selected passage:\n"""${input.passage}"""`,
      },
    ],
    1024,
    0.2
  );
  return String(parsed.answer ?? "").trim().slice(0, 3000);
}