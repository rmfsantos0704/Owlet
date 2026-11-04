import { ArrowRight, BookOpen, Highlighter, Puzzle, Sparkles } from "lucide-react";
import Modal from "./Modal";

const extensionUrl = (() => {
  const value = import.meta.env.VITE_CHROME_EXTENSION_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
})();

const steps = [
  {
    icon: Puzzle,
    title: "Capture with the browser extension",
    description: "Save useful web pages and selected passages to Owlet while you browse. Choose a collection and add tags or a note as you clip.",
  },
  {
    icon: BookOpen,
    title: "Keep research organized",
    description: "Collect sources in workspaces, search your library, and open any clip to review its citation, summary, highlights, and notes.",
  },
  {
    icon: Highlighter,
    title: "Build on what you find",
    description: "Highlight important passages, add comments, and bring your sources together with briefs and other research tools.",
  },
];

export default function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Welcome to Owlet"
      maxWidth="max-w-2xl"
      footer={
        <>
          {extensionUrl ? (
            <a href={extensionUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Get the Chrome extension <ArrowRight className="size-4" />
            </a>
          ) : (
            <span className="self-center text-xs text-slate-500">Chrome Web Store link coming soon</span>
          )}
          <button type="button" onClick={onClose} className="btn-primary">
            Start exploring
          </button>
        </>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand p-4 text-white">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm leading-6 text-blue-50">
          Owlet helps you collect, organize, and work with the sources you find online.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <section key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
              <Icon className="size-4" />
            </span>
            <p className="text-xs font-semibold text-slate-800">
              <span className="mr-1 text-slate-400">{index + 1}.</span>
              {title}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
          </section>
        ))}
      </div>
    </Modal>
  );
}
