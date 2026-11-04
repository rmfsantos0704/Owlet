import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, MousePointer2, Puzzle, ShieldCheck } from "lucide-react";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteHeader from "../components/PublicSiteHeader";
import { chromeExtensionUrl } from "../utils/chromeExtension";

const features = [
  {
    icon: Puzzle,
    title: "Clip as you read",
    description: "Save a web page to an Owlet Collection, along with its text and useful citation details.",
  },
  {
    icon: MousePointer2,
    title: "Keep important passages",
    description: "Save selected text from the page as a highlight, with the source attached to it.",
  },
  {
    icon: ShieldCheck,
    title: "Stay in control",
    description: "Choose the Collection for each clip. Your saved sources are waiting in your Owlet dashboard.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f6fa] text-slate-900">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <section className="relative overflow-hidden rounded-3xl bg-brand px-6 py-10 text-white shadow-xl shadow-blue-950/10 sm:px-10 sm:py-14">
          <div className="absolute -right-16 -top-20 size-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <Puzzle className="size-3.5" /> Owlet for Chrome
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Keep your research close while you browse.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
              Clip useful web pages and save the passages that matter. Owlet organizes them in your Collections, ready to revisit in your research dashboard.
            </p>
            {chromeExtensionUrl ? (
              <a
                href={chromeExtensionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
              >
                <Puzzle className="size-4" />
                Add to Chrome
                <ArrowUpRight className="size-4" />
              </a>
            ) : (
              <p role="status" className="mt-6 text-sm text-blue-100">
                The Chrome Web Store link is temporarily unavailable.
              </p>
            )}
            <p className="mt-4 text-xs text-blue-200">
              {chromeExtensionUrl ? "Free to add from the Chrome Web Store." : "Please try again later."}
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow mb-2 text-blue-600">What it does</p>
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              From a useful page to organized research.
            </h2>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 border-t border-slate-200 py-10 sm:py-12 md:grid-cols-2 md:gap-12">
          <div>
            <p className="eyebrow mb-2 text-blue-600">How to use it</p>
            <h2 className="text-xl font-semibold text-ink">Save a webpage or selected text</h2>
            <ol className="mt-5 space-y-4">
              {[
                "Sign in to Owlet from the extension and choose the Collection for your research.",
                "To save a page, open it in Chrome, click the Owlet extension, then choose “Clip this page.”",
                "To save a passage, select text and use the right-click “Save selection to Owlet” action or press Alt+Shift+S. If the page is not in the Collection yet, Owlet clips it first.",
              ].map((text, index) => (
                <li key={text} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="eyebrow mb-2 text-blue-600">In your dashboard</p>
            <h2 className="text-xl font-semibold text-ink">Your clips stay connected to their source</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Open the Collection you selected to find saved pages in your library. Each clip keeps its source details and saved text; selected passages are available as highlights on the clip. From there, you can add notes, comments, and citations, or revisit the original page.
            </p>
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
              <Check className="mt-1 size-4 shrink-0" />
              <span>One Collection keeps each project’s pages, highlights, and notes together.</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-ink">Privacy and permissions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Owlet does not read ordinary web pages in the background. Page content is read when you choose “Clip this page” or save selected text. The extension uses Chrome’s active-tab and scripting permissions for those actions, context menus for the right-click command, and local storage to remember your sign-in and Collection choice. Your saved page content is sent to Owlet so it can appear in your account.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                AI features are optional. When enabled, saved content may be sent to the AI provider to generate summaries; see the{" "}
                <Link to="/privacy" className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline">
            <ArrowRight className="size-4 rotate-180" /> Back to login
          </Link>
          {chromeExtensionUrl ? (
            <a href={chromeExtensionUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 hover:underline">
              Add to Chrome <ArrowUpRight className="inline size-4" />
            </a>
          ) : null}
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
