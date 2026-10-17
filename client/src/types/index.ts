export type ResearchItem = {
  _id: string;
  source: { url: string; domain?: string; title?: string; author?: string; publishedDate?: string };
  content?: { rawText?: string; wordCount?: number };
  aiOutput: { summary?: string; paraphrase?: string };
  citations: { apa?: string; mla?: string; chicago?: string };
  tags: string[];
  createdAt: string;
};