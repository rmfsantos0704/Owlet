import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PublicSiteFooter from "../PublicSiteFooter";
import PublicSiteHeader from "../PublicSiteHeader";
// The page frame shared by every auth screen: mascot on the left, the card on the right.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f6fa] text-slate-900">
      <PublicSiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-10 sm:px-5 sm:py-10 lg:flex-row lg:gap-20 lg:px-10">
        <section className="flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
          <div className="self-start">
            <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-[#0a234d] sm:text-4xl">
              Research smarter.
              <span className="block text-blue-600">Write with confidence.</span>
            </h1>
            <p className="mt-3 max-w-md text-base leading-7 text-slate-500">
              Keep every source, insight, and citation in one focused Collection.
            </p>
          </div>
          <div className="relative mt-2 w-full">
            <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-200/35 blur-3xl lg:left-[42%]" />
            <img
              src="/owlet-lockup.png"
              alt="Owlet mascot"
              className="relative mx-auto w-full max-w-[180px] object-contain drop-shadow-xl sm:max-w-[260px] lg:mx-0 lg:max-w-[320px]"
            />
          </div>
          <Link
            to="/extension"
            className="mt-3 inline-flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-md shadow-blue-900/5 transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-blue-600">Browser extension</span>
              <span className="mt-0.5 block text-sm font-bold text-[#0a234d]">Discover Owlet for Chrome</span>
              <span className="mt-0.5 block text-xs text-slate-500">See how it works and get started.</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-blue-600" />
          </Link>
        </section>
        <section className="w-full max-w-md">{children}</section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}

// The white card every auth screen puts its content in.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-300/45 sm:p-6">
      <h2 className="text-xl font-bold tracking-tight text-[#0a234d]">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
      {footer ? (
        <>
          <div className="my-5 h-px bg-slate-200" />
          <div className="text-center text-sm text-slate-500">{footer}</div>
        </>
      ) : null}
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`}>
      {children}
    </div>
  );
}