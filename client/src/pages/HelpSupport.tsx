import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileText,
  FileUp,
  Highlighter,
  LayoutGrid,
  LifeBuoy,
  Link2,
  ListChecks,
  Mail,
  Play,
  Search,
  Share2,
  Sparkles,
  Users,
  Gauge,
  FolderOutput,
  type LucideIcon,
} from "lucide-react";
import Modal from "../components/shared/Modal"; // adjust path to match where the file lives
import SupportModal from "../components/helpsupport/SupportModal"; // adjust path to match where the file lives
import { useAuth } from "../context/AuthContext";
import { openOnboardingAt } from "../utils/onboarding";

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/ahcmkkocefbjeoopiclnnmgemdbmooao?utm_source=item-share-cb";

// Icon tile colors: a light tint in light mode, a soft translucent tint in dark mode.
const ACCENT = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700",
} as const;

type Guide = { topic: string; icon: LucideIcon; title: string; text: string; accent: string };
type Faq = { topic: string; q: string; a: string };
type Topic = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

// `ai`: AI can be used right now. `off`: the person turned AI features off in their account.
function guides(ai: boolean, off: boolean): Guide[] {
  const list: Guide[] = [
    {
      topic: "getting-started",
      icon: Bookmark,
      title: "Clip a page",
      text: ai
        ? "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and writes an AI summary."
        : "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and builds the citations.",
      accent: ACCENT.blue,
    },
    {
      topic: "getting-started",
      icon: FileUp,
      title: "Import PDFs",
      text: "In a Collection, press Import PDF or drag PDF files anywhere on the page. You can add up to 10 files at a time, 15 MB each. Owlet keeps the original file so you can read and highlight it on the page.",
      accent: ACCENT.violet,
    },
    {
      topic: "notes",
      icon: Highlighter,
      title: "Highlight and comment",
      text: "Open a clip to highlight passages, add notes and leave comments. Highlights use their saved position to avoid confusing repeated phrases, and PDF highlights show a page number when available.",
      accent: ACCENT.amber,
    },
    {
      topic: "notes",
      icon: FileText,
      title: "Highlight on the original PDF",
      text: "Open a PDF clip and press the Original PDF card. The PDF opens on its own page: select text to highlight it, pick a color and add a note. The list on the right shows every highlight, and clicking one jumps to its page.",
      accent: ACCENT.amber,
    },
    {
      topic: "extension",
      icon: Highlighter,
      title: "Highlight while you read",
      text: "Select text on any page and right-click Save selection to Owlet, or press Alt+Shift+S. It saves to the Collection selected in the extension and clips the page first if needed.",
      accent: ACCENT.amber,
    },
    {
      topic: "research",
      icon: CircleHelp,
      title: "Set your research questions",
      text: "Open Evidence board from Workspaces. Under Research questions, write the main question this Collection is meant to answer, then add smaller supporting questions. Owners and editors can edit or delete them.",
      accent: ACCENT.sky,
    },
    {
      topic: "research",
      icon: LayoutGrid,
      title: "Arrange evidence on the board",
      text: "Press Add evidence, or the + on a column, to add highlights, whole sources or notes. Choose which question each card belongs to. Drag cards between Supports, Challenges, Background, Methodology and Open questions, or use Edit, then Move to, on a card. Click a question to see only the evidence filed under it.",
      accent: ACCENT.sky,
    },
    {
      topic: "research",
      icon: Gauge,
      title: "Read coverage and gaps",
      text: "Each question shows how many different sources support or challenge it: none, thin (1 source), moderate (2) or strong (3 or more). A question with both supporting and challenging evidence is flagged as conflicting. These are counts of what you filed, not AI judgments.",
      accent: ACCENT.sky,
    }
  ];

  if (ai) {
    list.push(
      {
        topic: "ai",
        icon: Sparkles,
        title: "Use the AI workspace",
        text: "Open it from the AI research assistant card on a Collection page. Pick up to 8 sources, choose a mode and run the analysis. Each run is saved under Recent sessions. AI use is limited to 10 generations per account each day.",
        accent: ACCENT.emerald,
      },
      {
        topic: "research-tools",
        icon: FileText,
        title: "Write a research brief",
        text: "Open Research briefs from Workspaces and press New brief. Pick a template and up to 8 sources, add an optional question, and choose whether to use your evidence board. Owlet writes the brief from your passages, highlights and literature-matrix entries. Each brief uses one AI generation.",
        accent: ACCENT.rose,
      },
      {
        topic: "research-tools",
        icon: ListChecks,
        title: "Check a brief's evidence",
        text: "Every paragraph has an Evidence list with the quotes it is based on. Verified means the quote was found word for word in your source. A warning appears when a paragraph has no verified quote. You can edit or remove paragraphs, mark a brief as ready, and export it as Markdown or PDF.",
        accent: ACCENT.rose,
      },
      {
        topic: "research-tools",
        icon: Search,
        title: "Search by meaning",
        text: "Open Concept search from Workspaces and describe an idea in your own words, for example “sources discussing the risks of AI dependency”. Results include sources, highlights, comments and matrix entries, even when they use different words. The first time, Owlet prepares your library for searching, which can take a moment.",
        accent: ACCENT.rose,
      }
    );
  } else {
    list.push(
      {
        topic: "summaries",
        icon: ListChecks,
        title: "Quick summary and tags",
        text: "Open a clip to see its Quick summary: key sentences picked from the text, plus key terms. Click a term to add it as a tag.",
        accent: ACCENT.cyan,
      },
      {
        topic: "summaries",
        icon: FileText,
        title: "Build a brief",
        text: "On the Highlights page, press Build a brief, tick the highlights you want and group them by source or by color. Owlet compiles them with your notes and an APA reference list. Copy it as Markdown or download it as a .md file.",
        accent: ACCENT.emerald,
      },
      {
        topic: "research-tools",
        icon: Sparkles,
        title: "AI research tools",
        text: off
          ? "Research briefs and concept search use AI, and you turned AI features off in your account. Open Account, find AI features and switch it back on to use them. Briefs you already have can still be opened, edited and exported."
          : "Research briefs and concept search use AI, which is unavailable right now (your daily allowance may be used up, or the AI providers are busy). Briefs you already have can still be opened, edited and exported.",
        accent: ACCENT.rose,
      }
    );
  }

  list.push({
    topic: "collaboration",
    icon: Share2,
    title: "Share a Collection",
    text: "Owners can create a join link from the Collection settings, or from the extension. Choose whether people join as viewers or editors, and when the link expires.",
    accent: ACCENT.sky,
  });
  list.push({
    topic: "organize",
    icon: FileText,
    title: "Build a literature matrix",
    text: "Open Literature matrix from Workspaces. Add your own columns, fill in each clip's cells, and export the collection matrix as CSV.",
    accent: ACCENT.cyan,
  });
  list.push({
    topic: "limits",
    icon: Sparkles,
    title: "Turn AI features on or off",
    text: "Open Account from the top bar, find AI features and use the switch. When AI is off, nothing you save is sent to an AI provider, new clips get the plain Quick summary, and the AI workspace, research briefs and concept search are unavailable to you. Summaries and briefs you already have stay.",
    accent: ACCENT.slate,
  });
  return list;
}

function faq(ai: boolean): Faq[] {
  const list: Faq[] = [];

  list.push(
    {
      topic: "limits",
      q: "How does the daily AI limit work?",
      a: "Each account can use AI for up to 10 generations per day. Summaries, PDF summaries, tests, regenerations, AI workspace runs and research briefs count. Concept search does not use the allowance. The allowance resets at 00:00 UTC. When you reach it, Owlet switches off AI-only tools for your account until the reset; your clips and built-in non-AI tools remain available.",
    },
    {
      topic: "limits",
      q: "Does one person's AI usage use up everyone else's limit?",
      a: "No. Each account has its own daily Owlet allowance. However, the AI providers' overall quotas are shared by Owlet, so if all configured providers are unavailable or have exhausted their quotas, AI may temporarily be unavailable for everyone. Owlet will not switch to its built-in paid provider models as a fallback.",
    },
    {
      topic: "limits",
      q: "Why might AI still be unavailable before I reach my limit?",
      a: "Owlet tries its configured providers (Groq, Gemini and OpenRouter) in sequence when one is unavailable. Their free-tier limits, model access and billing rules depend on each provider and can change. If none can serve the request, use Owlet's non-AI tools and try again later.",
    },
    {
      topic: "limits",
      q: "How do I turn AI features off?",
      a: "Open Account from the top bar and use the AI features switch. While it is off, Owlet doesn't write AI summaries for your new clips, and the AI workspace, research briefs and concept search are unavailable to you. Your clips and comments are removed from the concept search index, and you can turn AI back on at any time. Summaries and briefs you already have are kept.",
    },
    {
      topic: "limits",
      q: "What is sent to AI providers when AI is on?",
      a: "The text of clips you save, and the sources you pick for AI tools, are sent to AI providers to write summaries and briefs. Concept search also sends your clips, highlights, comments and matrix entries to Google to turn them into searchable vectors. With AI off, none of this happens for your account. Please don't upload confidential material while Owlet is in testing.",
    }
  );

  if (ai) {
    list.push({
      topic: "ai",
      q: "Why does a clip say the AI summary failed?",
      a: "The clip is still saved. The AI service may have been busy. Open the clip and press Regenerate to try the summary again.",
    });
  } else {
    list.push(
      {
        topic: "summaries",
        q: "Where does the Quick summary come from?",
        a: "Owlet picks the sentences that best reflect the most repeated terms in the text and shows them in the order they appear. It doesn't write anything new, so check the original for context. The key terms come from the same analysis.",
      },
      {
        topic: "summaries",
        q: "Why don't my clips have tags?",
        a: "Tags aren't added automatically. Open a clip and add your own, or click a key term in its Quick summary. Tags are also used to group clips in the Collection PDF export.",
      }
    );
  }

  list.push(
    {
      topic: "getting-started",
      q: "Why can't I import a PDF?",
      a: "Owlet needs a PDF with selectable text. Scanned, image-only PDFs aren't supported yet. Also check that the file is under 15 MB and that you're an owner or editor of the Collection.",
    },
    {
      topic: "getting-started",
      q: 'What does "Already clipped" mean?',
      a: "That page (or an identical PDF) is already in the Collection, so Owlet didn't save a second copy. Tracking parameters and page fragments are ignored when detecting web duplicates. You can open the existing clip from the message.",
    },
    {
      topic: "research",
      q: 'What do "Thin", "Strong" and "Conflicting evidence" mean?',
      a: "They describe how many different sources you filed as supporting or challenging a question: none, thin (1), moderate (2) or strong (3 or more). Conflicting evidence means a question has both supporting and challenging cards. Background, methodology and open-question cards don't count toward coverage.",
    },
    {
      topic: "research",
      q: "What happens to board cards when I delete a question or a source?",
      a: "Deleting a question removes the cards filed under it from the board, but the highlights and sources stay in your library. If you delete a clip or a highlight, its card disappears from the board.",
    },
    {
      topic: "research-tools",
      q: "Can I trust the citations in a research brief?",
      a: 'Verified means the quote was found word for word in your source, so it is real. It doesn\'t prove that the paragraph interprets the quote correctly. Paragraphs with no verified quote carry a warning. Always check the claims against the source before you rely on them.',
    },
    {
      topic: "research-tools",
      q: "Why can't I write a research brief?",
      a: "Briefs need AI, an owner or editor role in the Collection, and at least one source. Check that AI features are on in your Account and that your daily allowance isn't used up. Viewers can read and export briefs but not create or edit them.",
    },
    {
      topic: "research-tools",
      q: "How is concept search different from the search box?",
      a: "The search box at the top matches the words you type. Concept search matches meaning, so describing an idea finds sources, highlights, comments and matrix entries about it even when they use different words. New and changed clips are prepared for concept search automatically; if many are waiting, the page shows its progress and updates the results when it's done.",
    },
    {
      topic: "organize",
      q: "How do I export references for a bibliography?",
      a: "Select clips in the library, choose APA, MLA or Chicago, and copy the reference list. You can also export the selected clips as RIS for Zotero or EndNote.",
    },
    {
      topic: "collaboration",
      q: "What's the difference between owner, editor and viewer?",
      a: "Owners manage settings, members and join links. Editors can add clips, highlights, comments, board cards and briefs. Viewers can read everything but can't change anything.",
    },
    {
      topic: "collaboration",
      q: "Can I share my Personal Collection?",
      a: "No. Personal is private to you. Create a new Collection if you want to work with other people.",
    }
  );

  if (ai) {
    list.push({
      topic: "ai",
      q: "Can other people see my AI workspace sessions?",
      a: "No. Sessions are private to you, even in a shared Collection. Only the 20 most recent sessions per Collection are kept.",
    });
  }

  list.push({
    topic: "collaboration",
    q: "My join link stopped working.",
    a: "Links expire and can have a use limit. Ask the Collection owner to create a new one from the extension or the Collection settings.",
  });
  return list;
}

function topics(ai: boolean): Topic[] {
  const list: Topic[] = [
    {
      id: "getting-started",
      title: "Getting started",
      description: "Clip your first page, import PDFs and fix common clipping problems.",
      icon: BookOpen,
      color: ACCENT.blue,
    },
    {
      id: "extension",
      title: "Chrome extension",
      description: "Install the clipper and save research from any webpage.",
      icon: Link2,
      color: ACCENT.violet,
    },
    {
      id: "notes",
      title: "Highlights & notes",
      description: "Highlight text or the original PDF page, add notes and leave comments.",
      icon: Highlighter,
      color: ACCENT.amber,
    },
    {
      id: "research",
      title: "Research questions & evidence board",
      description: "Define your questions and arrange evidence by what supports or challenges them.",
      icon: LayoutGrid,
      color: ACCENT.sky,
    },
    {
      id: "research-tools",
      title: "Briefs & concept search",
      description: "Write cited research briefs and search your library by meaning.",
      icon: FileText,
      color: ACCENT.rose,
    },
  ];

  if (ai) {
    list.push({
      id: "ai",
      title: "AI workspace",
      description: "Run analyses across up to 8 sources and revisit past sessions.",
      icon: Sparkles,
      color: ACCENT.cyan,
    });
  } else {
    list.push({
      id: "summaries",
      title: "Summaries & briefs",
      description: "Quick summaries, key terms, tags and compiled briefs.",
      icon: ListChecks,
      color: ACCENT.cyan,
    });
  }

  list.push(
    {
      id: "organize",
      title: "Organize & export",
      description: "Literature matrix, reference lists and exports.",
      icon: FolderOutput,
      color: ACCENT.indigo,
    },
    {
      id: "collaboration",
      title: "Team collaboration",
      description: "Share Collections, roles and join links.",
      icon: Users,
      color: ACCENT.emerald,
    },
    {
      id: "limits",
      title: "AI usage & privacy",
      description: "How the daily AI allowance works, what is sent to AI providers, and how to turn AI off.",
      icon: Gauge,
      color: ACCENT.slate,
    }
  );
  return list;
}

// every word in the query has to appear somewhere in the text
function matches(query: string, ...parts: string[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = parts.join(" ").toLowerCase();
  return words.every((w) => hay.includes(w));
}

function FaqItem({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/70"
      >
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && <p className="px-5 pb-5 text-sm leading-6 text-slate-500">{a}</p>}
    </div>
  );
}

export default function HelpSupport() {
  const { aiEnabled, aiOffByUser } = useAuth();
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const GUIDES = useMemo(() => guides(aiEnabled, aiOffByUser), [aiEnabled, aiOffByUser]);
  const FAQ = useMemo(() => faq(aiEnabled), [aiEnabled]);
  const TOPICS = useMemo(() => topics(aiEnabled), [aiEnabled]);

  const q = query.trim();

  const visibleTopics = TOPICS.filter((t) =>
    matches(
      q,
      t.title,
      t.description,
      ...GUIDES.filter((g) => g.topic === t.id).flatMap((g) => [g.title, g.text]),
      ...FAQ.filter((f) => f.topic === t.id).flatMap((f) => [f.q, f.a])
    )
  );
  const visibleFaq = FAQ.filter((f) => matches(q, f.q, f.a));

  const showIntro = matches(q, "New to Owlet?", "Take a quick tour of clipping, organizing, and working with your research.", "Show the introduction", "tour");
  const showExtension = matches(
    q,
    "Get the Chrome extension",
    "Install extension",
    "Save articles, selections, and highlights to Owlet without leaving the page you're reading."
  );
  const showSupport = matches(q, "Still stuck?", "Tell us what you were doing and what happened. Screenshots help.", "Email support", "contact");
  const showPolicies = matches(q, "Policies", "Terms of service", "Privacy policy");

  const nothing =
    !visibleTopics.length && !visibleFaq.length && !showIntro && !showExtension && !showSupport && !showPolicies;

  const topic = TOPICS.find((t) => t.id === activeTopic) ?? null;
  const topicGuides = topic ? GUIDES.filter((g) => g.topic === topic.id) : [];
  const topicFaqs = topic ? FAQ.filter((f) => f.topic === topic.id) : [];

  return (
    <div>
      {/* hero + search */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-brand text-white shadow-lg shadow-blue-950/10">
        <div className="absolute -right-16 -top-20 size-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center gap-6 px-5 py-7 sm:px-7 sm:py-9">
          <img
            src="/owl.png"
            alt=""
            aria-hidden="true"
            className="hidden size-52 shrink-0 object-contain drop-shadow-lg md:block lg:size-60"
          />
          <div className="mx-auto min-w-0 max-w-2xl flex-1 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <LifeBuoy className="size-6 text-cyan-300" />
            How can we help?
          </h1>
          <p className="mt-2 text-sm leading-6 text-blue-100/70 sm:text-base">
            Quick guides for the things you'll do most, answers to common questions, and a way to reach us.
          </p>
          <div className="relative mx-auto mt-6 max-w-lg">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the help center"
              className="h-12 w-full rounded-xl border border-white/10 bg-white pl-12 pr-4 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-300/20"
              placeholder="Search the help center..."
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5 text-xs text-blue-100/70 sm:text-sm">
            <span></span>
            {["install extension", "import PDF", "evidence board", "turn off AI"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(term)}
                className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-blue-100 transition hover:bg-white/20 hover:text-white"
              >
                {term}
              </button>
            ))}
          </div>
          </div>
        </div>
      </section>

      {nothing && (
        <div className="card mb-8 border-dashed px-5 py-12 text-center">
          <Search className="mx-auto size-6 text-slate-300" />
          <div className="mt-3 text-sm font-semibold text-slate-700">Nothing found for "{q}"</div>
          <p className="mt-1 text-xs text-slate-400">Try a broader search or contact our support team.</p>
          <div className="mt-4 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Clear search
            </button>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Email support
            </button>
          </div>
        </div>
      )}

      {showIntro && (
        <section className="card mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">New to Owlet?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Take a quick tour of clipping, organizing, and working with your research.
            </p>
          </div>
          <button type="button" onClick={() => openOnboardingAt(0)} className="btn-secondary shrink-0">
            <Play className="size-4" /> Show the introduction
          </button>
        </section>
      )}

      {visibleTopics.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-semibold text-ink">Browse help topics</h2>
              <p className="mt-1 text-xs text-slate-400">Step-by-step guides for every part of Owlet.</p>
            </div>
            <span className="hidden text-xs font-medium text-slate-400 sm:block">
              {visibleTopics.length} {visibleTopics.length === 1 ? "topic" : "topics"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTopics.map((t) => {
              const Icon = t.icon;
              const gCount = GUIDES.filter((g) => g.topic === t.id).length;
              const fCount = FAQ.filter((f) => f.topic === t.id).length;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopic(t.id)}
                  className="card group flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/30"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.color}`}>
                    <Icon className="size-4.5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{t.title}</span>
                      <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500">{t.description}</span>
                    <span className="mt-3 block text-[10px] font-medium text-slate-400">
                      {gCount} {gCount === 1 ? "guide" : "guides"}
                      {fCount > 0 && ` · ${fCount} ${fCount === 1 ? "answer" : "answers"}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(visibleFaq.length > 0 || showExtension || showSupport || showPolicies) && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {visibleFaq.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-ink">Frequently asked questions</h2>
                <p className="mt-1 text-xs text-slate-400">Quick answers to common questions.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleFaq.map((item) => (
                  <FaqItem
                    key={item.q}
                    q={item.q}
                    a={item.a}
                    // while searching, show the answers so matches are visible
                    isOpen={q ? true : openFaq === item.q}
                    onToggle={() => setOpenFaq(openFaq === item.q ? null : item.q)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="space-y-6 xl:self-start">
            {showExtension && (
              <div className="help-extension-card rounded-2xl border border-violet-100 bg-violet-50/60 p-5 dark:border-violet-400/20 dark:bg-violet-500/10">
                <div className="help-extension-icon flex size-10 items-center justify-center rounded-xl shadow-sm">
                  <Link2 className="size-4.5" />
                </div>
                <h2 className="help-extension-title mt-4 font-semibold">Get the Chrome extension</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Save articles, selections, and highlights to Owlet without leaving the page you're reading.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(EXTENSION_URL, "_blank", "noopener,noreferrer")}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 py-2.5 text-xs font-bold text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400"
                >
                  Install extension
                  <ArrowUpRight className="size-3.5" />
                </button>
              </div>
            )}

            {showSupport && (
              <div className="rounded-2xl bg-brand p-5 text-white">
                <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                  <Mail className="size-4.5" />
                </div>
                <h2 className="mt-4 font-semibold">Still stuck?</h2>
                <p className="mt-2 text-xs leading-5 text-blue-100/70">
                  Tell us what you were doing and what happened. Screenshots help.
                </p>
                <button
                  type="button"
                  onClick={() => setSupportOpen(true)}
                  className="mt-4 block w-full rounded-xl bg-white py-2.5 text-center text-xs font-bold text-brand hover:bg-blue-50"
                >
                  Email support
                </button>
              </div>
            )}

            {showPolicies && (
              <div className="card p-5">
                <h2 className="mb-3 font-semibold text-ink">Policies</h2>
                <div className="space-y-2 text-sm">
                  <Link to="/terms" className="block font-medium text-blue-700 hover:underline">
                    Terms of service
                  </Link>
                  <Link to="/privacy" className="block font-medium text-blue-700 hover:underline">
                    Privacy policy
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* topic modal */}
      <Modal
        open={topic !== null}
        onClose={() => setActiveTopic(null)}
        title={topic?.title ?? ""}
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setActiveTopic(null);
                setSupportOpen(true);
              }}
              className="btn-secondary"
            >
              <CircleHelp className="size-4" /> Still stuck?
            </button>
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              Done
            </button>
          </>
        }
      >
        {topic && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">{topic.description}</p>

            {topicGuides.length > 0 && (
              <div className="space-y-3">
                {topicGuides.map(({ icon: Icon, title, text, accent }) => (
                  <div key={title} className="flex gap-3 rounded-xl border border-slate-100 p-4">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                      <Icon className="size-4.5" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-500">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {topic.id === "extension" && (
              <button
                type="button"
                onClick={() => window.open(EXTENSION_URL, "_blank", "noopener,noreferrer")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 py-2.5 text-xs font-bold text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                Install extension
                <ArrowUpRight className="size-3.5" />
              </button>
            )}

            {topic.id === "limits" && (
              <Link
                to="/account"
                onClick={() => setActiveTopic(null)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Open account settings
                <ArrowUpRight className="size-3.5" />
              </Link>
            )}

            {topicFaqs.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Related questions</h3>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
                  {topicFaqs.map((item) => (
                    <FaqItem
                      key={item.q}
                      q={item.q}
                      a={item.a}
                      isOpen={openFaq === `modal:${item.q}`}
                      onToggle={() => setOpenFaq(openFaq === `modal:${item.q}` ? null : `modal:${item.q}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}