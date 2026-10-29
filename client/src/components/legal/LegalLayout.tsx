import { Fragment, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { LEGAL, hasPlaceholders } from "../../legal/config";
import type { Section } from "../../legal/types";

// Shows any [bracketed placeholder] highlighted, so none gets published by accident.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/).map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export default function LegalLayout({
  title,
  intro,
  sections,
  other,
}: {
  title: string;
  intro: string;
  sections: Section[];
  other: { label: string; to: string };
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // Decided once on first render: "default" means this was the first entry in the session
  const canGoBack = useRef(location.key !== "default");

  const handleBack = () => {
    if (canGoBack.current) {
      navigate(-1);
      return;
    }
    // Opened directly or in a new tab: try to close the tab, which returns to the page that opened it
    window.close();
    // If the browser refused to close it, fall back to home
    setTimeout(() => navigate("/", { replace: true }), 100);
  };

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="size-8 rounded-[23.4%] shadow-md shadow-blue-950/15" />
            <span className="text-[15px] font-bold tracking-tight text-[#0a234d]">Owlet</span>
          </Link>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-slate-500 hover:text-[#102b5c]"
          >
            Back to Owlet
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {hasPlaceholders ? (
          <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="alert">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <p>
              <span className="font-semibold">Draft:</span> this page still has highlighted [placeholders]. Fill them in
              (<code>src/legal/config.ts</code>) and have a lawyer review it before launch.
            </p>
          </div>
        ) : null}

        <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-300/30 sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0a234d]">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated {LEGAL.lastUpdated} · Version {LEGAL.termsVersion}
          </p>
          <p className="mt-5 text-base leading-7 text-slate-600">{intro}</p>

          <nav aria-label="Contents" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Contents</p>
            <ol className="mt-2 columns-1 gap-6 text-sm sm:columns-2">
              {sections.map((s, i) => (
                <li key={s.id} className="py-0.5">
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-blue-700 hover:underline"
                  >
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 space-y-8">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="text-lg font-semibold text-[#0a234d]">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-2 space-y-3 text-[15px] leading-7 text-slate-600">
                  {s.body.map((block, j) =>
                    typeof block === "string" ? (
                      <p key={j}>
                        <Rich text={block} />
                      </p>
                    ) : (
                      <ul key={j} className="list-disc space-y-1.5 pl-6">
                        {block.map((item, k) => (
                          <li key={k}>
                            <Rich text={item} />
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>

        <p className="mt-6 text-center text-sm text-slate-500">
          Also read our{" "}
          <Link to={other.to} replace className="font-semibold text-blue-700 hover:underline">
            {other.label}
          </Link>
          .
        </p>
      </main>
    </div>
  );
}