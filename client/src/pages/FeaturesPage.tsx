import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bell, Bookmark, FileDown, FileText, FileUp, Highlighter, Link2, Lock, MessageSquareText,
  Puzzle, Quote, Search, ShieldCheck, Tag, Users, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PublicSiteHeader from "../components/publicsite/PublicSiteHeader"; // adjust the path if your file lives elsewhere

// The pages this one links to. Change the paths to match your router.
const EXTRA_LINKS = [
  { label: "About", to: "/about" },
  { label: "Extension", to: "/extension" },
];
const EXTENSION_PATH = "/extension";

// Things you plan to build. Leave empty to hide the section, or add short lines like "Highlighting directly on web pages".
const COMING_SOON: string[] = [];

type Feature = { icon: LucideIcon; title: string; text: string };
type Group = {
  id: string;
  label: string;
  title: string;
  blurb: string;
  accent: string;
  note?: string;
  features: Feature[];
};

const GROUPS: Group[] = [
  {
    id: "collect",
    label: "Collect",
    title: "Save what you read",
    blurb: "Get your sources into one place without copying and pasting.",
    accent: "bg-blue-50 text-blue-700",
    features: [
      {
        icon: Bookmark,
        title: "Clip any web page",
        text: "Click the Owlet extension on an article and it saves the text, title, author and date to the collection you choose. Clipping the same page twice is caught for you.",
      },
      {
        icon: FileUp,
        title: "Import PDFs",
        text: "Drop PDFs into a collection and Owlet extracts their text, so they can be searched and highlighted like any web page. Scanned, image-only PDFs aren't supported yet.",
      },
      {
        icon: Puzzle,
        title: "One login everywhere",
        text: "Log in on the website and the extension follows, and the other way round. You can also make a join link for a collection from the extension.",
      },
    ],
  },
  {
    id: "read",
    label: "Read & mark up",
    title: "Highlight what matters",
    blurb: "Mark the passages you will want again, and find them later.",
    accent: "bg-amber-50 text-amber-700",
    note: "Owlet can also offer AI-written summaries and an AI workspace when that option is switched on. When it is off, nothing you save is sent to an AI service.",
    features: [
      {
        icon: Highlighter,
        title: "Highlights in eight colors",
        text: "Select a passage, pick a color and add a note. Highlights are marked in the clip's text and collected on one Highlights page.",
      },
      {
        icon: Tag,
        title: "Quick summary and tags",
        text: "Each clip shows its key sentences and key terms, picked by simple text analysis in your browser. Click a term to add it as a tag.",
      },
      {
        icon: Search,
        title: "Search and filter",
        text: "Search the full text of your clips, or filter by tag, collection, highlight color and who made the highlight.",
      },
    ],
  },
  {
    id: "work",
    label: "Work together",
    title: "Talk it through with your group",
    blurb: "Share a collection and keep the discussion next to the sources.",
    accent: "bg-emerald-50 text-emerald-700",
    features: [
      {
        icon: MessageSquareText,
        title: "Comments and replies",
        text: "Comment on a clip or on a specific highlight, reply in threads, and edit or delete your own comments.",
      },
      {
        icon: Users,
        title: "Roles and invitations",
        text: "Owners, editors and viewers each get the right level of access. Inviting someone needs their acceptance, so nobody is added without saying yes.",
      },
      {
        icon: Link2,
        title: "Join links",
        text: "Share a link that expires after 1, 7 or 30 days and can be limited to a number of uses. People join only after they press Join.",
      },
      {
        icon: Bell,
        title: "Activity and notifications",
        text: "See what changed in a collection, and check the notification bell for what others did while you were away.",
      },
    ],
  },
  {
    id: "write",
    label: "Write it up",
    title: "Cite and compile",
    blurb: "Turn what you collected into something you can use in your paper.",
    accent: "bg-violet-50 text-violet-700",
    features: [
      {
        icon: Quote,
        title: "Citations in three styles",
        text: "APA, MLA and Chicago citations are generated for every clip. You can correct the details, and you should check them before you submit.",
      },
      {
        icon: FileText,
        title: "Build a brief",
        text: "Tick your highlights and get a brief grouped by source or by color, with recurring terms, your notes and an APA reference list. Copy it as Markdown or download it as a .md file.",
      },
      {
        icon: FileDown,
        title: "Export your work",
        text: "Export your library as BibTeX, CSV or JSON, download a clip or a whole collection as a PDF report or citation list, or download all of your data.",
      },
    ],
  },
  {
    id: "trust",
    label: "Your data",
    title: "Yours to keep or delete",
    blurb: "You stay in control of your account and what you save.",
    accent: "bg-sky-50 text-sky-700",
    features: [
      {
        icon: ShieldCheck,
        title: "Account control",
        text: "Confirm your email, change your password or email, sign out of every device, and delete your account. If you own shared collections, you choose what happens to them first.",
      },
      {
        icon: Lock,
        title: "Private by default",
        text: "Your Personal collection is only yours. Quick summaries and briefs run in your browser, and the Privacy Policy says exactly what is sent where if AI is ever switched on.",
      },
    ],
  },
];

const STEPS = [
  { title: "Install the extension", text: "Add Owlet to Chrome and log in once." },
  { title: "Clip and import", text: "Save web pages with one click, or drop in PDFs." },
  { title: "Highlight and discuss", text: "Mark passages, add notes and comment with your group." },
  { title: "Cite and compile", text: "Copy citations, or build a brief from your highlights." },
];

const AUDIENCE = ["Students working on a paper", "Study and research groups", "Anyone gathering sources"];

export default function FeaturesPage() {
  const { user } = useAuth();

  const scrollTo = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <PublicSiteHeader />

      <main>
        {/* hero */}
        <section className="mx-auto max-w-5xl px-5 pb-10 pt-14 text-center sm:pt-20">
          <p className="eyebrow mb-3 text-blue-600">What Owlet does</p>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-[#0a234d] sm:text-4xl">
            Collect, discuss and cite your sources in one place
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Owlet lets you clip web pages and PDFs, highlight what matters, talk it through with your group, and turn it
            into a cited brief.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <Link to="/" className="btn-primary">
                Open your library <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary">
                  Create an account <ArrowRight className="size-4" />
                </Link>
                <Link to="/login" className="btn-secondary">
                  Log in
                </Link>
              </>
            )}
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            {AUDIENCE.map((a) => (
              <li key={a} className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-200/80">
                {a}
              </li>
            ))}
          </ul>

          <nav aria-label="On this page" className="mt-8 flex flex-wrap justify-center gap-2">
            {GROUPS.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                onClick={scrollTo(g.id)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                {g.label}
              </a>
            ))}
          </nav>
        </section>

        {/* how it works */}
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <span className="mb-3 flex size-7 items-center justify-center rounded-lg bg-[#102b5c] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="text-sm font-semibold text-slate-800">{s.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* feature groups */}
        <div className="mx-auto max-w-5xl space-y-14 px-5 pb-14">
          {GROUPS.map((g) => (
            <section key={g.id} id={g.id} className="scroll-mt-6">
              <div className="mb-5">
                <p className="eyebrow text-blue-600">{g.label}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0a234d]">{g.title}</h2>
                <p className="mt-1.5 text-sm text-slate-500">{g.blurb}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.features.map((f) => (
                  <article key={f.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <span className={`mb-4 flex size-10 items-center justify-center rounded-xl ${g.accent}`}>
                      <f.icon className="size-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">{f.text}</p>
                  </article>
                ))}
              </div>
              {g.note && <p className="mt-4 text-xs leading-5 text-slate-400">{g.note}</p>}
            </section>
          ))}

          {COMING_SOON.length > 0 && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6">
              <h2 className="text-lg font-semibold text-[#0a234d]">On the way</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {COMING_SOON.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* closing call to action */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="rounded-2xl bg-[#102b5c] p-8 text-center text-white shadow-lg shadow-blue-950/10 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to try it?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-blue-100/80">
              Create an account, add the extension, and clip your first page in a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Link
                  to="/"
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#102b5c] hover:bg-blue-50"
                >
                  Open your library
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#102b5c] hover:bg-blue-50"
                  >
                    Create an account
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Log in
                  </Link>
                </>
              )}
              <Link
                to={EXTENSION_PATH}
                className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Get the extension
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Owlet</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            {EXTRA_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-[#102b5c]">
                {l.label}
              </Link>
            ))}
            <Link to="/terms" className="hover:text-[#102b5c]">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-[#102b5c]">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}