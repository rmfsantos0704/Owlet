import { useState } from "react";
import { ChevronDown, FileDown } from "lucide-react";
import { api } from "../services/api";

type Mode = "full" | "citations";

const OPTIONS: { mode: Mode; title: string; hint: string }[] = [
  { mode: "full", title: "Full report", hint: "Summaries, highlights, comments, and citations, grouped by topic" },
  { mode: "citations", title: "Citations only", hint: "APA, MLA, and Chicago lists, grouped by topic" },
];

export default function WorkspaceExportMenu({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(mode: Mode) {
    setOpen(false);
    setBusy(true);
    setError("");
    const slug = workspaceName.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "workspace";
    try {
      const r = await api<{ pdf: string }>(`/workspaces/${workspaceId}/export-pdf?mode=${mode}`);
      const bytes = Uint8Array.from(atob(r.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${mode === "full" ? "report" : "citations"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} disabled={busy} className="btn-secondary">
        {busy ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            Preparing PDF…
          </>
        ) : (
          <>
            <FileDown className="size-4" /> Export PDF <ChevronDown className="size-3.5" />
          </>
        )}
      </button>

      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            {OPTIONS.map((o) => (
              <button
                key={o.mode}
                onClick={() => go(o.mode)}
                className="block w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-ink">{o.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{o.hint}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}{" "}
          <button onClick={() => setError("")} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}