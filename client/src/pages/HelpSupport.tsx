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
import Modal from "../components/Modal"; // adjust path to match where the file lives
import SupportModal from "../components/SupportModal"; // adjust path to match where the file lives
import { useAuth } from "../context/AuthContext";
import { openOnboardingAt } from "../utils/onboarding";

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/ahcmkkocefbjeoopiclnnmgemdbmooao?utm_source=item-share-cb";

type Guide = { topic: string; icon: LucideIcon; title: string; text: string; accent: string };
type Faq = { topic: string; q: string; a: string };
type Topic = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

function guides(ai: boolean): Guide[] {
  const list: Guide[] = [
    {
      topic: "getting-started",
      icon: Bookmark,
      title: "Clip a page",
      text: ai
        ? "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and writes an AI summary."
        : "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and builds the citations.",
      accent: "bg-blue-50 text-blue-700",
    },
    {
      topic: "getting-started",
      icon: FileUp,
      title: "Import PDFs",
      text: "In a Collection, press Import PDF or drag PDF files anywhere on the page. You can add up to 10 files at a time, 15 MB each.",
      accent: "bg-violet-50 text-violet-700",
    },
    {
      topic: "notes",
      icon: Highlighter,
      title: "Highlight and comment",
      text: "Open a clip to highlight passages, add notes and leave comments. Highlights use their saved position to avoid confusing repeated phrases, and PDF highlights show a page number when available.",
      accent: "bg-amber-50 text-amber-700",
    },
    {
      topic: "extension",
      icon: Highlighter,
      title: "Highlight while you read",
      text: "Select text on any page and right-click Save selection to Owlet, or press Alt+Shift+S. It saves to the Collection selected in the extension and clips the page first if needed.",
      accent: "bg-amber-50 text-amber-700",
    },
  ];

  if (ai) {
    list.push({
      topic: "ai",
      icon: Sparkles,
      title: "Use the AI workspace",
      text: "Open it from the AI research assistant card on a Collection page. Pick up to 8 sources, choose a mode and run the analysis. Each run is saved under Recent sessions. AI use is limited to 10 generations per account each day.",
      accent: "bg-emerald-50 text-emerald-700",
    });
  } else {
    list.push(
      {
        topic: "summaries",
        icon: ListChecks,
        title: "Quick summary and tags",
        text: "Open a clip to see its Quick summary: key sentences picked from the text, plus key terms. Click a term to add it as a tag.",
        accent: "bg-cyan-50 text-cyan-700",
      },
      {
        topic: "summaries",
        icon: FileText,
        title: "Build a brief",
        text: "On the Highlights page, press Build a brief, tick the highlights you want and group them by source or by color. Owlet compiles them with your notes and an APA reference list. Copy it as Markdown or download it as a .md file.",
        accent: "bg-emerald-50 text-emerald-700",
      }
    );
  }

  list.push({
    topic: "collaboration",
    icon: Share2,
    title: "Share a Collection",
    text: "Owners can create a join link from the Collection settings, or from the extension. Choose whether people join as viewers or editors, and when the link expires.",
    accent: "bg-sky-50 text-sky-700",
  });
  list.push({
    topic: "organize",
    icon: FileText,
    title: "Build a literature matrix",
    text: "Open Literature matrix from Workspaces. Add your own columns, fill in each clip's cells, and export the collection matrix as CSV.",
    accent: "bg-cyan-50 text-cyan-700",
  });
  return list;
}

function faq(ai: boolean): Faq[] {
  const list: Faq[] = [];

  list.push(
    {
      topic: "limits",
      q: "How does the daily AI limit work?",
      a: "Each account can use AI for up to 10 generations per day. Summaries, PDF summaries, tests, regenerations and AI workspace runs count. The allowance resets at 00:00 UTC. When you reach it, Owlet switches off AI-only tools for your account until the reset; your clips and built-in non-AI tools remain available.",
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
      topic: "organize",
      q: "How do I export references for a bibliography?",
      a: "Select clips in the library, choose APA, MLA or Chicago, and copy the reference list. You can also export the selected clips as RIS for Zotero or EndNote.",
    },
    {
      topic: "collaboration",
      q: "What's the difference between owner, editor and viewer?",
      a: "Owners manage settings, members and join links. Editors can add clips, highlights and comments. Viewers can read everything but can't change anything.",
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
      color: "bg-blue-50 text-blue-700",
    },
    {
      id: "extension",
      title: "Chrome extension",
      description: "Install the clipper and save research from any webpage.",
      icon: Link2,
      color: "bg-violet-50 text-violet-700",
    },
    {
      id: "notes",
      title: "Highlights & notes",
      description: "Capture important passages, add notes and leave comments.",
      icon: Highlighter,
      color: "bg-amber-50 text-amber-700",
    },
  ];

  if (ai) {
    list.push({
      id: "ai",
      title: "AI workspace",
      description: "Run analyses across up to 8 sources and revisit past sessions.",
      icon: Sparkles,
      color: "bg-cyan-50 text-cyan-700",
    });
  } else {
    list.push({
      id: "summaries",
      title: "Summaries & briefs",
      description: "Quick summaries, key terms, tags and compiled briefs.",
      icon: ListChecks,
      color: "bg-cyan-50 text-cyan-700",
    });
  }

  list.push(
    {
      id: "organize",
      title: "Organize & export",
      description: "Literature matrix, reference lists and exports.",
      icon: FolderOutput,
      color: "bg-indigo-50 text-indigo-700",
    },
    {
      id: "collaboration",
      title: "Team collaboration",
      description: "Share Collections, roles and join links.",
      icon: Users,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      id: "limits",
      title: "AI usage & limits",
      description: "How the daily AI allowance and provider availability work.",
      icon: Gauge,
      color: "bg-slate-100 text-slate-700",
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
  const { aiEnabled } = useAuth();
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const GUIDES = useMemo(() => guides(aiEnabled), [aiEnabled]);
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
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-brand text-white shadow-lg shadow-blue-950/10">
        <div className="absolute -right-16 -top-20 size-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex items-center gap-4 py-4 pl-2 pr-5 sm:pl-3 sm:pr-8">
          <img
            src="/owl.png"
            alt=""
            aria-hidden="true"
            className="hidden size-44 shrink-0 object-contain drop-shadow-lg sm:block lg:size-48"
          />
          <div className="mx-auto min-w-0 max-w-xl flex-1 text-center">
          <h1 className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight">
            <LifeBuoy className="size-5 text-cyan-300" />
            How can we help?
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-blue-100/70">
            Quick guides for the things you'll do most, answers to common questions, and a way to reach us.
          </p>
          <div className="relative mx-auto mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search the help center"
              className="h-9 w-full rounded-xl border border-white/10 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-300/20"
              placeholder="Search the help center..."
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px] text-blue-100/60">
            <span></span>
            {["install extension", "import PDF", "share a collection"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(term)}
                className="font-semibold text-blue-100 hover:text-white hover:underline"
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
                  className="card group flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/50"
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
                <div className="flex size-10 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm dark:bg-violet-500/20 dark:text-violet-300 dark:shadow-none">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CircleHelp className="size-4" /> Still stuck?
            </button>
            <button
              type="button"
              onClick={() => setActiveTopic(null)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173b77]"
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