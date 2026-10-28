export type Highlight = { _id: string; text: string; color: string; note?: string; createdAt: string };
export type Comment = { _id: string; text: string; highlightId?: string; authorEmail?: string; createdAt: string };

export type Role = "owner" | "editor" | "viewer";
export type AiSettings = {
  format: "paragraph" | "bullets" | "academic" | "simple";
  length: "short" | "medium" | "detailed";
  instructions: string;
};
export type Collection = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  role: Role;
  memberCount: number;
  aiSettings: AiSettings;
};
export type Member = { userId: string; email: string; role: "editor" | "viewer" };
export type JoinLink = {
  token: string;
  role: "editor" | "viewer";
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  expired: boolean;
};
export type collectionDetail = Collection & {
  owner: { id: string; email: string };
  members: Member[];
  joinLink?: JoinLink | null; // only sent to the owner
};

export type ResearchItem = {
  _id: string;
  collectionId: string;
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
  snippet?: string; // only in search results: a short excerpt of the clip's text around the match
};
// an invitation waiting for the signed-in person to accept or decline
export type Invitation = {
  id: string;
  role: "editor" | "viewer";
  invitedBy: string;
  expiresAt: string;
  Collection: { id: string; name: string; description: string };
};
// an invitation the Collection owner sent that hasn't been answered yet
export type SentInvitation = { id: string; email: string; role: "editor" | "viewer"; expiresAt: string };

// what a join link shows before the person confirms
export type JoinPreview = {
  Collection: { name: string; description: string };
  ownerEmail: string;
  role: "editor" | "viewer";
  alreadyMember: boolean;
  collectionId: string;
};

export type ActivityType =
  | "clip_added" | "pdf_imported" | "highlight_added" | "comment_added"
  | "member_joined" | "member_left" | "member_removed";
export type ActivityPerson = { email: string | null; isYou: boolean };
export type ActivityEntry = {
  id: string;
  type: ActivityType;
  count: number;
  createdAt: string;
  actor: ActivityPerson;
  target: ActivityPerson | null;
  item: { id: string; title: string; exists: boolean } | null;
  Collection?: { id: string; name: string }; // only in notifications
  unread?: boolean; // only in notifications
};

// a quote backing up one AI workspace finding; `verified` means the wording was checked against the source text
export type AiEvidence = { source: number; quote: string; verified: boolean };

export type AiSession = {
  id: string;
  collectionId: string;
  title?: string; // user-chosen name; missing/empty on older sessions
  mode: "Research brief" | "Summarize" | "Compare sources";
  prompt: string;
  summary: string;
  findings: { title: string; text: string; sources: number[]; evidence?: AiEvidence[] }[]; // evidence is missing on older sessions
  sources: { id: string; title: string }[];
  createdAt: string;
};