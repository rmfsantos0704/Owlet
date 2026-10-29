export const HIGHLIGHT_COLORS = ["yellow", "orange", "red", "pink", "purple", "blue", "teal", "green"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

type Style = {
  label: string;
  dot: string; // the round swatch
  mark: string; // the highlight inside the clipped text
  card: string; // a highlight card in the list
  bar: string; // the left-bar card on the Highlights page
  quote: string; // a quoted highlight (comments, the picker)
};

// full class names on purpose: Tailwind only keeps classes it can see written out
export const COLOR_STYLES: Record<HighlightColor, Style> = {
  yellow: { label: "Yellow", dot: "bg-yellow-300", mark: "bg-yellow-200", card: "border-yellow-300 bg-yellow-50", bar: "border-l-amber-400 bg-amber-50/45", quote: "border-yellow-400 bg-yellow-50" },
  orange: { label: "Orange", dot: "bg-orange-300", mark: "bg-orange-200", card: "border-orange-300 bg-orange-50", bar: "border-l-orange-400 bg-orange-50/45", quote: "border-orange-400 bg-orange-50" },
  red: { label: "Red", dot: "bg-red-300", mark: "bg-red-200", card: "border-red-300 bg-red-50", bar: "border-l-red-400 bg-red-50/45", quote: "border-red-400 bg-red-50" },
  pink: { label: "Pink", dot: "bg-pink-300", mark: "bg-pink-200", card: "border-pink-300 bg-pink-50", bar: "border-l-pink-400 bg-pink-50/45", quote: "border-pink-400 bg-pink-50" },
  purple: { label: "Purple", dot: "bg-purple-300", mark: "bg-purple-200", card: "border-purple-300 bg-purple-50", bar: "border-l-purple-400 bg-purple-50/45", quote: "border-purple-400 bg-purple-50" },
  blue: { label: "Blue", dot: "bg-blue-300", mark: "bg-blue-200", card: "border-blue-300 bg-blue-50", bar: "border-l-blue-500 bg-blue-50/45", quote: "border-blue-400 bg-blue-50" },
  teal: { label: "Teal", dot: "bg-teal-300", mark: "bg-teal-200", card: "border-teal-300 bg-teal-50", bar: "border-l-teal-500 bg-teal-50/45", quote: "border-teal-400 bg-teal-50" },
  green: { label: "Green", dot: "bg-green-300", mark: "bg-green-200", card: "border-green-300 bg-green-50", bar: "border-l-emerald-500 bg-emerald-50/45", quote: "border-green-400 bg-green-50" },
};

export const styleFor = (color?: string): Style => COLOR_STYLES[color as HighlightColor] ?? COLOR_STYLES.yellow;

// kept for files that already import it: the plain background class for each color
export const COLORS: Record<string, string> = Object.fromEntries(
  HIGHLIGHT_COLORS.map((c) => [c, COLOR_STYLES[c].mark])
);