import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  ChevronDown,
  FileText,
  FileUp,
  Highlighter,
  LifeBuoy,
  ListChecks,
  Mail,
  Play,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import SupportModal from "../components/SupportModal"; // adjust path to match where the file lives
import { useAuth } from "../context/AuthContext";
import OnboardingModal from "../components/OnboardingModal";

type Guide = { icon: LucideIcon; title: string; text: string; accent: string };

function guides(ai: boolean): Guide[] {
  const list: Guide[] = [
    {
      icon: Bookmark,
      title: "Clip a page",
      text: ai
        ? "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and writes an AI summary."
        : "Open an article, click the Owlet extension, pick a Collection, optionally add tags or a short note about why you saved it, and press Clip this page. Owlet saves the text and builds the citations.",
      accent: "bg-blue-50 text-blue-700",
    },
    {
      icon: FileUp,
      title: "Import PDFs",
      text: "In a Collection, press Import PDF or drag PDF files anywhere on the page. You can add up to 10 files at a time, 15 MB each.",
      accent: "bg-violet-50 text-violet-700",
    },
    {
      icon: Highlighter,
      title: "Highlight and comment",
      text: "Open a clip to highlight passages, add notes and leave comments. Highlights use their saved position to avoid confusing repeated phrases, and PDF highlights show a page number when available.",
      accent: "bg-amber-50 text-amber-700",
    },
    {
      icon: Highlighter,
      title: "Highlight while you read",
      text: "Select text on any page and right-click Save selection to Owlet, or press Alt+Shift+S. It saves to the Collection selected in the extension and clips the page first if needed.",
      accent: "bg-amber-50 text-amber-700",
    },
  ];

  if (ai) {
    list.push({
      icon: Sparkles,
      title: "Use the AI workspace",
      text: "Open it from the AI research assistant card on a Collection page. Pick up to 8 sources, choose a mode and run the analysis. Each run is saved under Recent sessions. AI use is limited to 10 generations per account each day.",
      accent: "bg-emerald-50 text-emerald-700",
    });
  } else {
    list.push(
      {
        icon: ListChecks,
        title: "Quick summary and tags",
        text: "Open a clip to see its Quick summary: key sentences picked from the text, plus key terms. Click a term to add it as a tag.",
        accent: "bg-cyan-50 text-cyan-700",
      },
      {
        icon: FileText,
        title: "Build a brief",
        text: "On the Highlights page, press Build a brief, tick the highlights you want and group them by source or by color. Owlet compiles them with your notes and an APA reference list. Copy it as Markdown or download it as a .md file.",
        accent: "bg-emerald-50 text-emerald-700",
      }
    );
  }

  list.push({
    icon: Share2,
    title: "Share a Collection",
    text: "Owners can create a join link from the Collection settings, or from the extension. Choose whether people join as viewers or editors, and when the link expires.",
    accent: "bg-sky-50 text-sky-700",
  });
  list.push({
    icon: FileText,
    title: "Build a literature matrix",
    text: "Open Literature matrix from Workspaces. Add your own columns, fill in each clip's cells, and export the collection matrix as CSV.",
    accent: "bg-cyan-50 text-cyan-700",
  });
  return list;
}

function faq(ai: boolean): [string, string][] {
  const list: [string, string][] = [];

  list.push(
    [
      "How does the daily AI limit work?",
      "Each account can use AI for up to 10 generations per day. Summaries, PDF summaries, tests, regenerations and AI workspace runs count. The allowance resets at 00:00 UTC. When you reach it, Owlet switches off AI-only tools for your account until the reset; your clips and built-in non-AI tools remain available.",
    ],
    [
      "Does one person's AI usage use up everyone else's limit?",
      "No. Each account has its own daily Owlet allowance. However, the AI providers' overall quotas are shared by Owlet, so if all configured providers are unavailable or have exhausted their quotas, AI may temporarily be unavailable for everyone. Owlet will not switch to its built-in paid provider models as a fallback.",
    ],
    [
      "Why might AI still be unavailable before I reach my limit?",
      "Owlet tries its configured providers (Groq, Gemini and OpenRouter) in sequence when one is unavailable. Their free-tier limits, model access and billing rules depend on each provider and can change. If none can serve the request, use Owlet's non-AI tools and try again later.",
    ]
  );

  if (ai) {
    list.push([
      "Why does a clip say the AI summary failed?",
      "The clip is still saved. The AI service may have been busy. Open the clip and press Regenerate to try the summary again.",
    ]);
  } else {
    list.push(
      [
        "Where does the Quick summary come from?",
        "Owlet picks the sentences that best reflect the most repeated terms in the text and shows them in the order they appear. It doesn't write anything new, so check the original for context. The key terms come from the same analysis.",
      ],
      [
        "Why don't my clips have tags?",
        "Tags aren't added automatically. Open a clip and add your own, or click a key term in its Quick summary. Tags are also used to group clips in the Collection PDF export.",
      ]
    );
  }

  list.push(
    [
      "Why can't I import a PDF?",
      "Owlet needs a PDF with selectable text. Scanned, image-only PDFs aren't supported yet. Also check that the file is under 15 MB and that you're an owner or editor of the Collection.",
    ],
    [
      "What does \"Already clipped\" mean?",
      "That page (or an identical PDF) is already in the Collection, so Owlet didn't save a second copy. Tracking parameters and page fragments are ignored when detecting web duplicates. You can open the existing clip from the message.",
    ],
    [
      "How do I export references for a bibliography?",
      "Select clips in the library, choose APA, MLA or Chicago, and copy the reference list. You can also export the selected clips as RIS for Zotero or EndNote.",
    ],
    [
      "What's the difference between owner, editor and viewer?",
      "Owners manage settings, members and join links. Editors can add clips, highlights and comments. Viewers can read everything but can't change anything.",
    ],
    [
      "Can I share my Personal Collection?",
      "No. Personal is private to you. Create a new Collection if you want to work with other people.",
    ]
  );

  if (ai) {
    list.push([
      "Can other people see my AI workspace sessions?",
      "No. Sessions are private to you, even in a shared Collection. Only the 20 most recent sessions per Collection are kept.",
    ]);
  }

  list.push([
    "My join link stopped working.",
    "Links expire and can have a use limit. Ask the Collection owner to create a new one from the extension or the Collection settings.",
  ]);
  return list;
}

export default function HelpSupport() {
  const { aiEnabled } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const GUIDES = guides(aiEnabled);
  const FAQ = faq(aiEnabled);

  return (
    <div>
      <section className="mb-8">
        <div className="eyebrow mb-2 flex items-center gap-2 text-blue-600">
          <LifeBuoy className="size-3.5" />
          Help &amp; support
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">How can we help?</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Quick guides for the things you'll do most, answers to common questions, and a way to reach us.
        </p>
      </section>

      <section className="card mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">New to Owlet?</h2>
          <p className="mt-1 text-sm text-slate-500">Take a quick tour of clipping, organizing, and working with your research.</p>
        </div>
        <button type="button" onClick={() => setOnboardingOpen(true)} className="btn-secondary shrink-0">
          <Play className="size-4" /> Show the introduction
        </button>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 font-semibold text-ink">Getting started</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GUIDES.map(({ icon: Icon, title, text, accent }) => (
            <div key={title} className="card p-5">
              <span className={`mb-4 flex size-9 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="size-4.5" strokeWidth={1.9} />
              </span>
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-ink">Frequently asked questions</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {FAQ.map(([q, a], i) => {
              const isOpen = open === i;
              return (
                <div key={q}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
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
            })}
          </div>
        </div>

        <div className="space-y-6 xl:self-start">
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
        </div>
      </section>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}