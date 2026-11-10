import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileDown, X } from "lucide-react";
import { api, download } from "../../services/api";

type Mode = "full" | "citations";
type FileFormat = "docx" | "markdown" | "csv" | "bibtex" | "ris" | "json";

type ExportOption =
  | { kind: "pdf"; mode: Mode; title: string; hint: string }
  | { kind: "file"; format: FileFormat; extension: string; title: string; hint: string };

const OPTIONS: ExportOption[] = [
  { kind: "pdf", mode: "full", title: "Full report · PDF", hint: "Highlights, comments, summaries, and citations" },
  { kind: "file", format: "docx", extension: "docx", title: "Research report · Word", hint: "Editable document with notes, highlights, and citations" },
  { kind: "file", format: "markdown", extension: "md", title: "Research report · Markdown", hint: "Readable text with notes, highlights, and citations" },
  { kind: "pdf", mode: "citations", title: "Citations · PDF", hint: "APA, MLA, and Chicago lists" },
  { kind: "file", format: "csv", extension: "csv", title: "Source data · CSV", hint: "Open in Excel, Google Sheets, or similar" },
  { kind: "file", format: "bibtex", extension: "bib", title: "Bibliography · BibTeX", hint: "For LaTeX and reference managers" },
  { kind: "file", format: "ris", extension: "ris", title: "Bibliography · RIS", hint: "For Zotero, EndNote, and reference managers" },
  { kind: "file", format: "json", extension: "json", title: "Collection data · JSON", hint: "Structured data for reuse" },
];

const optionKey = (option: ExportOption) => (option.kind === "pdf" ? `pdf-${option.mode}` : option.format);

export default function CollectionExportMenu({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(option: ExportOption) {
    setOpen(false);
    setBusy(true);
    setError("");
    const slug = collectionName.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "Collection";
    try {
      if (option.kind === "pdf") {
        const r = await api<{ pdf: string }>(`/collections/${encodeURIComponent(collectionId)}/export-pdf?mode=${option.mode}`);
        const bytes = Uint8Array.from(atob(r.pdf), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-${option.mode === "full" ? "report" : "citations"}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        await download(
          `/collections/${encodeURIComponent(collectionId)}/export?format=${option.format}`,
          `${slug}-${option.format}.${option.extension}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const optionButtons = OPTIONS.map((option) => (
    <button
      key={optionKey(option)}
      onClick={() => go(option)}
      className="block w-full rounded-lg px-3 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:py-2.5"
    >
      <div className="text-sm font-semibold text-ink">{option.title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{option.hint}</div>
    </button>
  ));

  return (
    <div className="relative">
      {/* phone: icon only. desktop: icon + label + chevron */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-expanded={open}
        aria-label={busy ? "Preparing export" : "Export collection"}
        title="Export collection"
        className="btn-secondary !px-3 !py-2 sm:!px-4"
      >
        {busy ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <span className="hidden sm:inline">Preparing export…</span>
          </>
        ) : (
          <>
            <FileDown className="size-4" />
            <span className="hidden sm:inline">Export collection</span>
            <ChevronDown className="hidden size-3.5 sm:block" />
          </>
        )}
      </button>

      {/* desktop: dropdown under the button */}
      {open && (
        <div className="hidden sm:block">
          <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 max-h-[min(70vh,32rem)] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            {optionButtons}
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
              Includes up to the 500 most recent clips.
            </div>
          </div>
        </div>
      )}

      {/* phone: bottom sheet. It's portaled to <body> because the header's blur would otherwise trap it inside the header. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] sm:hidden">
            <button aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              aria-label="Export collection"
              className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">Export collection</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">{optionButtons}</div>
              <div className="shrink-0 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-slate-400">
                Includes up to the 500 most recent clips.
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* errors: a banner at the top on phones (portaled for the same reason), a popover under the button on desktop */}
      {error &&
        createPortal(
          <div className="fixed inset-x-3 top-16 z-[70] rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg sm:hidden">
            {error}{" "}
            <button onClick={() => setError("")} className="font-semibold underline">
              Dismiss
            </button>
          </div>,
          document.body
        )}
      {error && (
        <div className="absolute right-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:block">
          {error}{" "}
          <button onClick={() => setError("")} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}