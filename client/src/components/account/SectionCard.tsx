import type { ReactNode } from "react";

export default function SectionCard({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${danger ? "!border-red-200" : ""}`}>
      <h2 className={`font-semibold ${danger ? "text-red-700" : "text-ink"}`}>{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Note({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}