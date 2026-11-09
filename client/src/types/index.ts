export type Highlight = {
  _id: string;
  text: string;
  color: string;
  note?: string;
  startOffset?: number;
  endOffset?: number;
  page?: number;
  rects?: { x: number; y: number; w: number; h: number }[]; // PDF highlights: position on the page, as fractions
  createdAt: string;
};
export type Comment = {
  _id: string;
  text: string;
  highlightId?: string;
  parentId?: string; // set on replies: the _id of the comment being answered
  authorEmail?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Role = "owner" | "editor" | "viewer";
export type AiSettings = {
  format: "paragraph" | "bullets" | "academic" | "simple";
  length: "short" | "medium" | "detailed";
  instructions: string;
};
// fallback for clips that have no settings saved yet; keep in sync with the server default
export const DEFAULT_AI_SETTINGS: AiSettings = {
  format: "paragraph",
  length: "medium",
  instructions: "",
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
  personalNote?: string;
  readingStatus?: "to_read" | "reading" | "done";
  userSummary?: string;
  source: {
    kind?: "web" | "pdf";
    url?: string;
    fileName?: string;
    domain?: string;
    title?: string;
    author?: string;
    authors?: string[];
    publishedDate?: string;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;
    fileUrl?: string; // PDF imports: where the original file can be opened
  };
  content?: { rawText?: string; wordCount?: number; pageOffsets?: number[] };
  matrixValues?: Record<string, string>;
  aiOutput: { summary?: string; paraphrase?: string };
  aiQuotaExceeded?: boolean;
  aiSettings?: AiSettings; // per-clip summary settings; missing on clips saved before this existed
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
  collection: { id: string; name: string; description: string };
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
  | "member_joined" | "member_left" | "member_removed" | "evidence_added" | "evidence_moved" | "evidence_removed"
  | "question_added" | "question_changed" | "question_removed" ;
export type ActivityPerson = { email: string | null; isYou: boolean };
export type ActivityEntry = {
  id: string;
  type: ActivityType;
  count: number;
  createdAt: string;
  actor: ActivityPerson;
  target: ActivityPerson | null;
  item: { id: string; title: string; exists: boolean } | null;
  collection?: { id: string; name: string }; // only in notifications
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

// ---- evidence board and research questions ----
export type Stance = "supports" | "challenges" | "background" | "methodology" | "open";
export type ResearchQuestion = { id: string; kind: "main" | "supporting"; text: string };
export type EvidenceLink = {
  id: string;
  questionId: string | null; // null = not tied to a specific question
  stance: Stance;
  kind: "highlight" | "clip" | "note";
  note: string; // the text of a note card
  order: number;
  itemId?: string;
  highlightId?: string;
  evidence?: { title: string; origin?: string; quote?: string; color?: string; page?: number; note?: string };
};
export type Strength = "none" | "thin" | "moderate" | "strong";
export type QuestionSummary = {
  questionId: string;
  supports: number;
  challenges: number;
  background: number;
  methodology: number;
  open: number;
  sources: number; // different sources that support or challenge it
  strength: Strength;
  conflict: boolean; // has both supporting and challenging evidence
};
export type BoardResponse = { questions: ResearchQuestion[]; links: EvidenceLink[]; summaries: QuestionSummary[] };

// ---- research briefs ----
export type BriefTemplateId =
  | "literature_review"
  | "study_guide"
  | "argument_outline"
  | "research_summary"
  | "meeting_brief"
  | "annotated_bibliography";
export type BriefCitation = {
  source: number; // 1-based position in the brief's source list
  itemId?: string;
  highlightId?: string;
  kind: "text" | "highlight" | "matrix";
  quote: string;
  verified: boolean; // the quote was found word for word in the source
};
export type BriefBlock = { id: string; text: string; edited: boolean; citations: BriefCitation[] };
export type BriefSection = { id: string; title: string; blocks: BriefBlock[] };
export type Brief = {
  id: string;
  collectionId: string;
  title: string;
  template: BriefTemplateId;
  question: string;
  status: "draft" | "ready";
  generator?: "ai" | "outline"; // "outline" = built without AI from the researcher's own material; missing on older briefs
  wordCount: number;
  sources: { itemId: string; title: string; reference: string }[];
  sections: BriefSection[];
  createdAt: string;
  updatedAt: string;
};
export type BriefSummary = {
  id: string;
  title: string;
  template: BriefTemplateId;
  question: string;
  status: "draft" | "ready";
  generator?: "ai" | "outline";
  sourceCount: number;
  wordCount: number;
  updatedAt: string;
};

// ---- concept search ----
export type SearchResult = {
  id: string;
  kind: "clip" | "highlight" | "comment" | "matrix";
  itemId: string;
  collectionId: string;
  collectionName?: string; // only when searching across collections
  title: string;
  origin?: string;
  snippet: string;
  match: "strong" | "good" | "related"; // relative to the best match for this search
  page?: number;
  color?: string;
  author?: string;
};
export type SearchResponse = { results: SearchResult[]; pending: number; total: number };