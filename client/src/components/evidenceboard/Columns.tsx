import type { Stance } from "../../types";

// the five columns of the evidence board, in order
export const COLUMNS: { stance: Stance; label: string; hint: string; tone: string }[] = [
  {
    stance: "supports",
    label: "Supports",
    hint: "Evidence that backs your question.",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    stance: "challenges",
    label: "Challenges",
    hint: "Evidence that argues against it.",
    tone: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  {
    stance: "background",
    label: "Background",
    hint: "Context the reader needs.",
    tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    stance: "methodology",
    label: "Methodology",
    hint: "How the studies were done.",
    tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    stance: "open",
    label: "Open questions",
    hint: "What is still unanswered.",
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
];