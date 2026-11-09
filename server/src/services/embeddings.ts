// Turns text into vectors so searches can match meaning instead of exact words.
// Uses Google's Gemini embeddings with the same GEMINI_API_KEY the AI fallback already uses.
// Only this file knows about the provider: to switch to another one, change embedTexts() and keep its signature.

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
// must match "numDimensions" in the Atlas vector index
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS) || 768;
// stored with every vector, so changing the model or size makes old vectors count as out of date
export const MODEL_TAG = `${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}`;

const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 20_000;

export class EmbeddingsUnavailableError extends Error {
  constructor(message = "Semantic search isn't set up on this server.") {
    super(message);
    this.name = "EmbeddingsUnavailableError";
  }
}

export const embeddingsConfigured = () => Boolean(process.env.GEMINI_API_KEY);

async function embedBatch(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new EmbeddingsUnavailableError();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: task,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: controller.signal,
      });
      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // one short retry when the provider is busy
        continue;
      }
      if (!response.ok) throw new Error(`Embeddings request failed (HTTP ${response.status})`);
      const data = (await response.json()) as { embeddings?: { values?: number[] }[] };
      const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error("Embeddings response had an unexpected shape");
      }
      return vectors;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Embeddings request failed");
}

export async function embedTexts(texts: string[], purpose: "document" | "query"): Promise<number[][]> {
  const task = purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    out.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE), task)));
  }
  return out;
}