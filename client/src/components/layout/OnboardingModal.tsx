import { useEffect, useMemo, useRef, useState } from "react";
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
const AI_USAGE_TARGET = "owlet-tour-ai-usage";

// steps that point at the top bar; every other step points at the sidebar
const HEADER_TARGETS = [COLLECTION_TOOLS_TARGET, AI_USAGE_TARGET];

type Props = {
  open: boolean;
  onClose: () => void;
  initialStep?: number;
  // phones: tells the layout whether the sidebar drawer should be open for the current step
  onSidebarNeeded?: (needed: boolean) => void;
};
type Position = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight?: number; // only set in phone sheet mode
};

const PANEL_ESTIMATED_HEIGHT = 390;
const PHONE_QUERY = "(max-width: 639px)";

export default function OnboardingModal({ open, onClose, initialStep = 0, onSidebarNeeded }: Props) {
  const { user, aiUsage } = useAuth();
  const hasAiUsage = !!aiUsage;
  const email = user?.email;

  // keep the latest callback without re-running effects when its identity changes
  const sidebarCallbackRef = useRef(onSidebarNeeded);
  sidebarCallbackRef.current = onSidebarNeeded;

  // The collection tools only exist in the top bar while a collection is open. The step is always part
  // of the tour; when those buttons aren't on screen it is shown as a centered panel instead of
  // pointing at them (and it points at them as soon as they appear).
  const [hasCollectionTools, setHasCollectionTools] = useState(false);
  useEffect(() => {
    if (!open) return;
    // the buttons only count as "on screen" if they exist AND take up space (they can be present but
    // hidden, e.g. collapsed on narrow screens, and pointing at a hidden element looks broken).
    // The element is looked up on every check, so it is picked up even if the page (for example
    // after navigating to the home route) renders it a moment after the tour opens.
    const check = () => {
      const el = document.getElementById(COLLECTION_TOOLS_TARGET);
      if (!el) {
        setHasCollectionTools(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      setHasCollectionTools(el.childElementCount > 0 && rect.width > 0 && rect.height > 0);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", check);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [open]);

  // Built once per sign-in / AI availability, so the step object stays stable between renders.
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
      {
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
      },
    ];

    if (hasAiUsage) {
      list.push({
        target: AI_USAGE_TARGET,
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
  }, [hasAiUsage, email]);

  const [stepIndex, setStepIndex] = useState(() => Math.max(initialStep, 0));
  const [position, setPosition] = useState<Position | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const hasPosition = position !== null;

  // Every time the guide opens it starts from the beginning (or from `initialStep`), and when it closes
  // the stored position is cleared, so it never resumes where the person left off.
  useEffect(() => {
    if (open) {
      setStepIndex(Math.max(initialStep, 0));
    } else {
      setPosition(null);
    }
  }, [open, initialStep]);

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];

  // the tools step is shown centered when no Collection is open, since there is nothing to point at
  const centered = step.target === COLLECTION_TOOLS_TARGET && !hasCollectionTools;

  // phones: the sidebar is a drawer, so open it for sidebar steps and close it for top-bar steps
  useEffect(() => {
    if (!open) return;
    sidebarCallbackRef.current?.(!HEADER_TARGETS.includes(step.target));
  }, [open, step.target]);

  useEffect(() => {
    if (!open) return;
    let target = centered ? null : document.getElementById(step.target);
    // a target that exists but is hidden can't be pointed at
    if (target) {
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) target = null;
    }

    const isPhone = () => window.matchMedia(PHONE_QUERY).matches;
    const width = () => Math.min(320, window.innerWidth - 24);
    // use the panel's real height once it is on screen, so tall steps (like the tools step) aren't cut off
    const panelHeight = () => Math.min(panelRef.current?.offsetHeight || PANEL_ESTIMATED_HEIGHT, window.innerHeight - 24);

    // no element to point at (not open, not rendered): center the panel instead of waiting forever
    if (!target) {
      const placeCentered = () => {
        const w = width();
        const left = Math.max(12, (window.innerWidth - w) / 2);
        const top = Math.max(12, (window.innerHeight - panelHeight()) / 2);
        setPosition({ top, left, width: w });
      };
      placeCentered();
      window.addEventListener("resize", placeCentered);
      return () => window.removeEventListener("resize", placeCentered);
    }

    const el = target;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    el.classList.add("onboarding-highlight");

    const updatePosition = () => {
      const rect = el.getBoundingClientRect();

      // Phone: a full-width sheet pinned to the top or bottom, on whichever side of the target has more
      // room, so the highlighted element stays visible instead of being covered.
      if (isPhone()) {
        const margin = 12;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeBelow = spaceBelow >= spaceAbove;
        const space = Math.max(spaceAbove, spaceBelow) - margin * 2;
        const maxHeight = Math.min(window.innerHeight * 0.5, Math.max(space, 160));
        setPosition({
          left: margin,
          width: window.innerWidth - margin * 2,
          maxHeight,
          ...(placeBelow ? { bottom: margin } : { top: margin }),
        });
        return;
      }

      // Larger screens: float beside the target
      const w = width();
      const right = rect.right + 12;
      const left = right + w <= window.innerWidth - 12 ? right : Math.max(12, rect.left - w - 12);
      const height = panelHeight();
      const top = Math.min(
        Math.max(12, rect.top + rect.height / 2 - height / 2),
        Math.max(12, window.innerHeight - height - 12)
      );
      setPosition({ top, left, width: w });
    };

    updatePosition();
    // the phone drawer slides in over ~200ms; measure again once it has settled
    const settle = window.setTimeout(updatePosition, 260);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(settle);
      el.classList.remove("onboarding-highlight");
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
    // hasPosition: re-run once the panel first appears so its real height is used
  }, [open, step, centered, hasPosition]);

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
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-description"
          className="fixed z-[110] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-2xl shadow-slate-950/25 sm:p-5"
          style={{
            top: position.top,
            bottom: position.bottom,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
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
          {centered && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              No Collection is open right now. Open one from the sidebar to see these buttons in the top bar.
            </p>
          )}
          {safeIndex === 0 && (
            <p className="mt-3 hidden rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500 sm:block">
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