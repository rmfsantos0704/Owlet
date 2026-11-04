import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Highlighter, UsersRound } from "lucide-react";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteHeader from "../components/PublicSiteHeader";

const features = [
  { icon: BookOpen, title: "Collect sources", text: "Save web pages and PDFs into Collections organized around your projects." },
  { icon: Highlighter, title: "Work with what matters", text: "Highlight passages, add notes, and keep useful citations with each source." },
  { icon: UsersRound, title: "Research together", text: "Share Collections with collaborators and choose their access level." },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f6fa] text-slate-900">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        <section className="max-w-3xl">
          <p className="eyebrow mb-3 text-blue-600">About Owlet</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            A calmer home for your research.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Owlet helps you collect useful sources, keep track of the ideas inside them, and bring your research together in focused Collections.
          </p>
          <Link to="/extension" className="btn-primary mt-7 inline-flex items-center gap-2">
            Explore the Chrome extension <ArrowRight className="size-4" />
          </Link>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-ink">Ready to start your library?</h2>
            <p className="mt-1 text-sm text-slate-600">Sign in or create an Owlet account to get started.</p>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
            Log in <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
