import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  ChevronDown,
  FileUp,
  Highlighter,
  LifeBuoy,
  Mail,
  Share2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Change this to the address people should write to.
const SUPPORT_EMAIL = "support@owlet.app";

const GUIDES: { icon: LucideIcon; title: string; text: string; accent: string }[] = [
  {
    icon: Bookmark,
    title: "Clip a page",
    text: "Open an article, click the Owlet extension, pick a Collection and press Clip this page. Owlet saves the text and writes an AI summary.",
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
    text: "Open a clip to highlight passages, add notes and leave comments. Everything shows up on the Highlights and Comments pages.",
    accent: "bg-amber-50 text-amber-700",
  },
  {
    icon: Sparkles,
    title: "Use the AI workspace",
    text: "Open it from the AI research assistant card on a Collection page. Pick up to 8 sources, choose a mode and run the analysis. Each run is saved under Recent sessions.",
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: Share2,
    title: "Share a Collection",
    text: "Owners can create a join link from the Collection settings, or from the extension. Choose whether people join as viewers or editors, and when the link expires.",
    accent: "bg-sky-50 text-sky-700",
  },
];

const FAQ: [string, string][] = [
  [
    "Why does a clip say the AI summary failed?",
    "The clip is still saved. The AI service may have been busy. Open the clip and press Regenerate to try the summary again.",
  ],
  [
    "Why can't I import a PDF?",
    "Owlet needs a PDF with selectable text. Scanned, image-only PDFs aren't supported yet. Also check that the file is under 15 MB and that you're an owner or editor of the Collection.",
  ],
  [
    "What does \"Already clipped\" mean?",
    "That page (or an identical PDF) is already in the Collection, so Owlet didn't save a second copy. You can open the existing clip from the message.",
  ],
  [
    "What's the difference between owner, editor and viewer?",
    "Owners manage settings, members and join links. Editors can add clips, highlights and comments. Viewers can read everything but can't change anything.",
  ],
  [
    "Can I share my Personal Collection?",
    "No. Personal is private to you. Create a new Collection if you want to work with other people.",
  ],
  [
    "Can other people see my AI workspace sessions?",
    "No. Sessions are private to you, even in a shared Collection. Only the 20 most recent sessions per Collection are kept.",
  ],
  [
    "My join link stopped working.",
    "Links expire and can have a use limit. Ask the Collection owner to create a new one from the extension or the Collection settings.",
  ],
];

export default function HelpSupport() {
  const [open, setOpen] = useState<number | null>(0);

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
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Owlet%20support`}
              className="mt-4 block w-full rounded-xl bg-white py-2.5 text-center text-xs font-bold text-brand hover:bg-blue-50"
            >
              Email support
            </a>
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
    </div>
  );
}