import { COLOR_STYLES, HIGHLIGHT_COLORS, type HighlightColor } from "./colors";
import { recurringTerms } from "./textAnalysis";

export type BriefHighlight = {
  id: string;
  text: string;
  note?: string;
  color: string;
  itemId: string;
  sourceTitle: string;
  apa: string;
  createdAt: string;
};
export type GroupBy = "source" | "color";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const sortKey = (s: string) => oneLine(s).replace(/^[^a-z0-9]+/i, "").toLowerCase();
const byTime = (a: BriefHighlight, b: BriefHighlight) => +new Date(a.createdAt) - +new Date(b.createdAt);
const titleOf = (h: BriefHighlight) => oneLine(h.sourceTitle) || "Untitled";

const block = (h: BriefHighlight, withSource: boolean) =>
  `> “${oneLine(h.text)}”` +
  (h.note?.trim() ? `\n\n**Note:** ${oneLine(h.note)}` : "") +
  (withSource ? `\n\n— *${titleOf(h)}*` : "");

export function buildBrief(list: BriefHighlight[], groupBy: GroupBy): string {
  const sourceCount = new Set(list.map((h) => h.itemId)).size;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const out: string[] = [
    "# Research brief",
    "",
    `*${list.length} highlight${list.length === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"} · ${date}*`,
    "",
  ];

  const terms = recurringTerms(list.map((h) => `${h.text}. ${h.note ?? ""}`));
  if (terms.length) {
    out.push(
      "## Recurring terms",
      "",
      "*Words and phrases that appear in more than one highlight. The number is how many.*",
      "",
      terms.map((t) => `${t.term} (${t.count})`).join(" · "),
      ""
    );
  }

  if (groupBy === "source") {
    out.push("## Highlights by source", "");
    const groups = new Map<string, BriefHighlight[]>();
    for (const h of list) {
      const g = groups.get(h.itemId);
      if (g) g.push(h);
      else groups.set(h.itemId, [h]);
    }
    const ordered = [...groups.values()].sort((a, b) => sortKey(titleOf(a[0])).localeCompare(sortKey(titleOf(b[0]))));
    for (const g of ordered) {
      out.push(`### ${titleOf(g[0])}`, "");
      for (const h of [...g].sort(byTime)) out.push(block(h, false), "");
    }
  } else {
    out.push("## Highlights by color", "");
    const known = new Set<string>(HIGHLIGHT_COLORS);
    const order: { key: string; label: string }[] = [
      ...HIGHLIGHT_COLORS.map((c) => ({ key: c as string, label: COLOR_STYLES[c as HighlightColor].label })),
      { key: "other", label: "Other" },
    ];
    for (const { key, label } of order) {
      const group = list.filter((h) => (known.has(h.color) ? h.color : "other") === key);
      if (!group.length) continue;
      out.push(`### ${label} (${group.length})`, "");
      const sorted = [...group].sort((a, b) => sortKey(titleOf(a)).localeCompare(sortKey(titleOf(b))) || byTime(a, b));
      for (const h of sorted) out.push(block(h, true), "");
    }
  }

  const refs = new Map<string, string>();
  for (const h of list) if (!refs.has(h.itemId)) refs.set(h.itemId, oneLine(h.apa) || titleOf(h));
  out.push("## References (APA)", "");
  for (const r of [...refs.values()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) out.push(`- ${r}`);
  out.push(
    "",
    "---",
    "",
    "*Compiled by Owlet from your own highlights and notes. Citations are auto-generated: check each one before you submit.*",
    ""
  );

  return out.join("\n");
}

export function downloadMarkdown(text: string, name = "owlet-brief") {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000); // revoking right away can cancel the download in some browsers
}