export type Highlight = { _id: string; text: string; color: string; note?: string; createdAt: string };
export type Comment = { _id: string; text: string; highlightId?: string; authorEmail?: string; createdAt: string };

export type Role = "owner" | "editor" | "viewer";
export type AiSettings = {
  format: "paragraph" | "bullets" | "academic" | "simple";
  length: "short" | "medium" | "detailed";
  instructions: string;
};
export type Workspace = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  role: Role;
  memberCount: number;
  aiSettings: AiSettings;
};
export type Member = { userId: string; email: string; role: "editor" | "viewer" };
export type WorkspaceDetail = Workspace & { owner: { id: string; email: string }; members: Member[] };

export type ResearchItem = {
  _id: string;
  workspaceId: string;
  source: {
    kind?: "web" | "pdf";
    url?: string;
    fileName?: string;
    domain?: string;
    title?: string;
    author?: string;
    publishedDate?: string;
  };
  content?: { rawText?: string; wordCount?: number };
  aiOutput: { summary?: string; paraphrase?: string };
  citations: { apa?: string; mla?: string; chicago?: string };
  tags: string[];
  highlights: Highlight[];
  comments: Comment[];
  createdAt: string;
};