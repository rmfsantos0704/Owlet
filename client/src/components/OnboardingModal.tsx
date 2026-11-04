import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, FolderKanban, Layers3, Puzzle, X } from "lucide-react";

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
    target: "owlet-tour-workspaces",
    icon: Layers3,
    title: "Workspaces are your research tools",
    description: "These links are different ways to work with your saved research. They don't move or copy clips between Collections.",
    items: [
      ["All clips", "Search and browse clips across every Collection you can access."],
      ["Highlights & Comments", "Review passages you've marked and conversations on clips."],
      ["Literature matrix", "Compare sources in a structured table."],
      ["AI workspace", "Run research analysis on selected sources when AI is available."],
    ],
  },
  {
    target: "owlet-tour-collections",
    icon: FolderKanban,
    title: "Collections keep projects separate",
    description: "A Collection is a place for the clips, highlights, and comments belonging to one project or topic. The selected Collection is your current workspace for saving and browsing.",
    items: [
      ["Personal", "Your private Collection; other people can't see its contents."],
      ["Shared", "Invite collaborators as editors or viewers. Editors can contribute; viewers can read."],
    ],
  },
  {
    target: "owlet-tour-collection-list",
    icon: BookOpen,
    title: "Choose and manage Collections here",
    description: "Select a Collection to open it. Use the + button to create one, or the three-dot menu beside a Collection to find its settings, members, and sharing options.",
    items: [
      ["Tip", "When clipping with the browser extension, choose the Collection where the page should be saved."],
    ],
  },
];

type Props = { open: boolean; onClose: () => void; initialStep?: number };
type Position = { top: number; left: number; width: number };

export default function OnboardingModal({ open, onClose, initialStep = 0 }: Props) {
  const [stepIndex, setStepIndex] = useState(() => Math.min(Math.max(initialStep, 0), steps.length - 1));
  const [position, setPosition] = useState<Position | null>(null);
  const step = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    if (!open) return;
    const target = document.getElementById(step.target);
    if (!target) return;

    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    target.classList.add("onboarding-highlight");

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const right = rect.right + 12;
      const left = right + width <= window.innerWidth - 12
        ? right
        : Math.max(12, rect.left - width - 12);
      const estimatedHeight = 390;
      const top = Math.min(
        Math.max(12, rect.top + rect.height / 2 - estimatedHeight / 2),
        Math.max(12, window.innerHeight - estimatedHeight - 12)
      );
      setPosition({ top, left, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      target.classList.remove("onboarding-highlight");
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const Icon = step.icon;
  const lastStep = stepIndex === steps.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-950/35" aria-hidden="true" />
      {position ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-description"
          className="fixed z-[110] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 shadow-2xl shadow-slate-950/25"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-blue-600">Owlet guide · {stepIndex + 1} of {steps.length}</p>
              <h2 id="onboarding-title" className="mt-1 text-base font-semibold leading-5 text-ink">{step.title}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close guide" className="-mr-2 -mt-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <X className="size-4" />
            </button>
          </div>
          <p id="onboarding-description" className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
          <ul className="mt-3 space-y-2.5">
            {step.items.map(([label, text]) => (
              <li key={label} className="text-xs leading-5 text-slate-500">
                <span className="font-semibold text-slate-800">{label}: </span>{text}
              </li>
            ))}
          </ul>
          {stepIndex === 0 && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              Use the links under <span className="font-semibold text-slate-700">Workspaces</span> to switch tools; use <span className="font-semibold text-slate-700">Collections</span> to switch projects.
            </p>
          )}
          {lastStep ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              {extensionUrl ? (
                <a href={extensionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                  <Puzzle className="size-3.5" /> Get the Chrome extension <ArrowRight className="size-3.5" />
                </a>
              ) : (
                <p className="text-xs text-slate-500">The Chrome Web Store link will be available here once the extension is published.</p>
              )}
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <button type="button" onClick={onClose} className="text-xs font-medium text-slate-500 hover:text-slate-800">Skip tour</button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 ? (
                <button type="button" onClick={() => setStepIndex((current) => current - 1)} className="btn-secondary !px-3 !py-2 text-xs">
                  <ArrowLeft className="size-3.5" /> Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => (lastStep ? onClose() : setStepIndex((current) => current + 1))}
                className="btn-primary !px-3 !py-2 text-xs"
              >
                {lastStep ? "Done" : "Next"} {!lastStep && <ArrowRight className="size-3.5" />}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div role="status" className="fixed left-1/2 top-1/2 z-[110] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-xl">
          Opening the guide…
        </div>
      )}
    </>
  );
}
