import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, FolderKanban, LayoutGrid, Layers3, Puzzle, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import { chromeExtensionUrl } from "../../utils/chromeExtension";
import { useAuth } from "../../context/AuthContext";

type Step = {
  target: string; // id of the element the panel points at
  icon: LucideIcon;
  title: string;
  description: string;
  items: [string, string][];
};

const COLLECTION_LIST_TARGET = "owlet-tour-collection-list";
// the area of the top bar where a collection's own tools appear (set in Layout)
const COLLECTION_TOOLS_TARGET = "owlet-tour-collection-tools";

type Props = { open: boolean; onClose: () => void; initialStep?: number };
type Position = { top: number; left: number; width: number };

export default function OnboardingModal({ open, onClose, initialStep = 0 }: Props) {
  const { user, aiUsage } = useAuth();
  const hasAiUsage = !!aiUsage;
  const email = user?.email;

  // The collection tools only exist in the top bar while a collection is open, so that step is only
  // included when those buttons are actually on screen (and it appears as soon as they are).
  const [hasCollectionTools, setHasCollectionTools] = useState(false);
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(COLLECTION_TOOLS_TARGET);
    if (!el) {
      setHasCollectionTools(false);
      return;
    }
    const check = () => setHasCollectionTools(el.childElementCount > 0);
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, [open]);

  // Built once per sign-in / AI availability, so the step object stays stable between renders.
  // A step is left out when the thing it points at isn't on screen (the tour would wait forever for it).
  const steps = useMemo<Step[]>(() => {
    const list: Step[] = [
      {
        target: "owlet-tour-workspaces",
        icon: Layers3,
        title: "Workspaces are your research tools",
        description: "These links are different ways to work with your saved research. They don't move or copy clips between Collections.",
        items: [
          ["All clips", "Search and browse clips across every Collection you can access."],
          ["Highlights & Comments", "Review passages you've marked and conversations on clips."],
          ["AI workspace", "Run research analysis on selected sources when AI is available."],
          ["Concept search", "Find clips by meaning, not just exact words, so related ideas turn up even when the wording differs."],
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
        target: COLLECTION_LIST_TARGET,
        icon: BookOpen,
        title: "Choose and manage Collections here",
        description: "Select a Collection to open it. Use the + button to create one, or the three-dot menu beside a Collection to find its settings, members, and sharing options.",
        items: [
          ["Tip", "When clipping with the browser extension, choose the Collection where the page should be saved."],
        ],
      },
    ];

    if (hasCollectionTools) {
      list.push({
        target: COLLECTION_TOOLS_TARGET,
        icon: LayoutGrid,
        title: "Tools for the open Collection",
        description: "When you open a Collection, its own tools appear in the top bar. Each one belongs to that Collection only, so every Collection has its own matrix, evidence board, and briefs.",
        items: [
          ["Import PDF", "Add PDFs to this Collection. You can also drop files anywhere on the page."],
          ["Literature matrix", "Compare your sources in a table with columns you choose, and export it as CSV."],
          ["Research briefs", "Write structured briefs from your sources. Every claim links back to the passage it came from."],
          ["Evidence board", "Sort highlights and notes under what they support, challenge, or leave open for your research questions."],
          ["Activity, Export & Settings", "See what's new, export the Collection, and change its settings."],
        ],
      });
    }

    if (hasAiUsage) {
      list.push({
        target: "owlet-tour-ai-usage",
        icon: Sparkles,
        title: "Your daily AI allowance",
        description: "This meter in the top bar counts the AI features you've used today, such as summaries, research briefs, and the AI workspace. Hover over it, or tab to it, to see how many uses you have left.",
        items: [
          ["Used / limit", "The first number is what you've used today; the second is your daily limit."],
          ["Resets", "Your allowance resets at midnight UTC."],
          ["When it runs out", "AI features pause until the reset. Your clips, highlights, and comments keep working."],
        ],
      });
    }

    if (email) {
      list.push({
        target: "owlet-tour-account",
        icon: UserRound,
        title: "Your account",
        description: "The Account link at the bottom of the sidebar shows your initials. Click it to open your account page.",
        items: [
          ["Signed in as", email],
          ["Account settings", "Manage your email, password, appearance, and data from the account page."],
          ["Log out", "The arrow icon beside Account signs you out."],
        ],
      });
    }

    return list;
  }, [hasAiUsage, hasCollectionTools, email]);

  const [stepIndex, setStepIndex] = useState(() => Math.max(initialStep, 0));
  const [position, setPosition] = useState<Position | null>(null);
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];

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
  const lastStep = safeIndex === steps.length - 1;

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
              <p className="eyebrow text-blue-600">Owlet guide · {safeIndex + 1} of {steps.length}</p>
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
                <span className="font-semibold text-slate-800">{label}: </span>
                <span className="break-all">{text}</span>
              </li>
            ))}
          </ul>
          {safeIndex === 0 && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              Use the links under <span className="font-semibold text-slate-700">Workspaces</span> to switch tools; use <span className="font-semibold text-slate-700">Collections</span> to switch projects.
            </p>
          )}
          {step.target === COLLECTION_LIST_TARGET ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              {chromeExtensionUrl ? (
                <a href={chromeExtensionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
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
              {safeIndex > 0 ? (
                <button type="button" onClick={() => setStepIndex(safeIndex - 1)} className="btn-secondary !px-3 !py-2 text-xs">
                  <ArrowLeft className="size-3.5" /> Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => (lastStep ? onClose() : setStepIndex(safeIndex + 1))}
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