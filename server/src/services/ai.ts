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
