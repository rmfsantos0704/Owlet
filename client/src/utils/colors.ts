export const HIGHLIGHT_COLORS = [
  "yellow", "orange", "red", "pink", "purple", "blue", "teal", "green",
  "lime", "cyan", "indigo", "fuchsia", "gray",
] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

type Style = {
  label: string;
  dot: string; // the round swatch
  mark: string; // the highlight inside the clipped text
  card: string; // a highlight card in the list
  bar: string; // the left-bar card on the Highlights page
  quote: string; // a quoted highlight (comments, the picker)
};

// Full class names on purpose: Tailwind only keeps classes it can see written out.
// Dark mode: the same hue as a see-through tint (so it glows less than the pastel does), never white.
// It uses the 400/500 shades because index.css re-maps the blue/red 50-300 shades for dark mode.
export const COLOR_STYLES: Record<HighlightColor, Style> = {
  yellow: {
    label: "Yellow",
    dot: "bg-yellow-300 dark:bg-yellow-400",
    mark: "bg-yellow-200 dark:bg-yellow-500/40",
    card: "border-yellow-300 bg-yellow-50 dark:border-yellow-500/50 dark:bg-yellow-500/15",
    bar: "border-l-amber-400 bg-amber-50/45 dark:bg-amber-500/15",
    quote: "border-yellow-400 bg-yellow-50 dark:border-yellow-500/60 dark:bg-yellow-500/15",
  },
  orange: {
    label: "Orange",
    dot: "bg-orange-300 dark:bg-orange-400",
    mark: "bg-orange-200 dark:bg-orange-500/40",
    card: "border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/15",
    bar: "border-l-orange-400 bg-orange-50/45 dark:bg-orange-500/15",
    quote: "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-500/15",
  },
  red: {
    label: "Red",
    dot: "bg-red-300 dark:bg-red-400",
    mark: "bg-red-200 dark:bg-red-500/40",
    card: "border-red-300 bg-red-50 dark:border-red-500/50 dark:bg-red-500/15",
    bar: "border-l-red-400 bg-red-50/45 dark:bg-red-500/15",
    quote: "border-red-400 bg-red-50 dark:border-red-500/60 dark:bg-red-500/15",
  },
  pink: {
    label: "Pink",
    dot: "bg-pink-300 dark:bg-pink-400",
    mark: "bg-pink-200 dark:bg-pink-500/40",
    card: "border-pink-300 bg-pink-50 dark:border-pink-500/50 dark:bg-pink-500/15",
    bar: "border-l-pink-400 bg-pink-50/45 dark:bg-pink-500/15",
    quote: "border-pink-400 bg-pink-50 dark:border-pink-500/60 dark:bg-pink-500/15",
  },
  purple: {
    label: "Purple",
    dot: "bg-purple-300 dark:bg-purple-400",
    mark: "bg-purple-200 dark:bg-purple-500/40",
    card: "border-purple-300 bg-purple-50 dark:border-purple-500/50 dark:bg-purple-500/15",
    bar: "border-l-purple-400 bg-purple-50/45 dark:bg-purple-500/15",
    quote: "border-purple-400 bg-purple-50 dark:border-purple-500/60 dark:bg-purple-500/15",
  },
  blue: {
    label: "Blue",
    dot: "bg-blue-300 dark:bg-blue-400",
    mark: "bg-blue-200 dark:bg-blue-500/40",
    card: "border-blue-300 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/15",
    bar: "border-l-blue-500 bg-blue-50/45 dark:bg-blue-500/15",
    quote: "border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-500/15",
  },
  teal: {
    label: "Teal",
    dot: "bg-teal-300 dark:bg-teal-400",
    mark: "bg-teal-200 dark:bg-teal-500/40",
    card: "border-teal-300 bg-teal-50 dark:border-teal-500/50 dark:bg-teal-500/15",
    bar: "border-l-teal-500 bg-teal-50/45 dark:bg-teal-500/15",
    quote: "border-teal-400 bg-teal-50 dark:border-teal-500/60 dark:bg-teal-500/15",
  },
  green: {
    label: "Green",
    dot: "bg-green-300 dark:bg-green-400",
    mark: "bg-green-200 dark:bg-green-500/40",
    card: "border-green-300 bg-green-50 dark:border-green-500/50 dark:bg-green-500/15",
    bar: "border-l-emerald-500 bg-emerald-50/45 dark:bg-emerald-500/15",
    quote: "border-green-400 bg-green-50 dark:border-green-500/60 dark:bg-green-500/15",
  },
  lime: {
    label: "Lime",
    dot: "bg-lime-300 dark:bg-lime-400",
    mark: "bg-lime-200 dark:bg-lime-500/40",
    card: "border-lime-300 bg-lime-50 dark:border-lime-500/50 dark:bg-lime-500/15",
    bar: "border-l-lime-500 bg-lime-50/45 dark:bg-lime-500/15",
    quote: "border-lime-400 bg-lime-50 dark:border-lime-500/60 dark:bg-lime-500/15",
  },
  cyan: {
    label: "Cyan",
    dot: "bg-cyan-300 dark:bg-cyan-400",
    mark: "bg-cyan-200 dark:bg-cyan-500/40",
    card: "border-cyan-300 bg-cyan-50 dark:border-cyan-500/50 dark:bg-cyan-500/15",
    bar: "border-l-cyan-500 bg-cyan-50/45 dark:bg-cyan-500/15",
    quote: "border-cyan-400 bg-cyan-50 dark:border-cyan-500/60 dark:bg-cyan-500/15",
  },
  indigo: {
    label: "Indigo",
    dot: "bg-indigo-300 dark:bg-indigo-400",
    mark: "bg-indigo-200 dark:bg-indigo-500/40",
    card: "border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/15",
    bar: "border-l-indigo-500 bg-indigo-50/45 dark:bg-indigo-500/15",
    quote: "border-indigo-400 bg-indigo-50 dark:border-indigo-500/60 dark:bg-indigo-500/15",
  },
  fuchsia: {
    label: "Fuchsia",
    dot: "bg-fuchsia-300 dark:bg-fuchsia-400",
    mark: "bg-fuchsia-200 dark:bg-fuchsia-500/40",
    card: "border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-500/50 dark:bg-fuchsia-500/15",
    bar: "border-l-fuchsia-500 bg-fuchsia-50/45 dark:bg-fuchsia-500/15",
    quote: "border-fuchsia-400 bg-fuchsia-50 dark:border-fuchsia-500/60 dark:bg-fuchsia-500/15",
  },
  gray: {
    label: "Gray",
    dot: "bg-slate-300 dark:bg-slate-400",
    mark: "bg-slate-200 dark:bg-slate-500/40",
    card: "border-slate-300 bg-slate-50 dark:border-slate-500/50 dark:bg-slate-500/15",
    bar: "border-l-slate-400 bg-slate-50/45 dark:bg-slate-500/15",
    quote: "border-slate-400 bg-slate-50 dark:border-slate-500/60 dark:bg-slate-500/15",
  },
};

export const styleFor = (color?: string): Style => COLOR_STYLES[color as HighlightColor] ?? COLOR_STYLES.yellow;

// kept for files that already import it: the plain background class for each color
export const COLORS: Record<string, string> = Object.fromEntries(
  HIGHLIGHT_COLORS.map((c) => [c, COLOR_STYLES[c].mark])
);