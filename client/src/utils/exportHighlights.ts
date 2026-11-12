import type { ResearchItem } from "../types";

// Highlights as Markdown, grouped by page, each quote followed by its page and note:
//   > "the highlighted text" (p. 12)
export function highlightsToMarkdown(item: ResearchItem): string {
  const s = item.source;
  const highlights = [...item.highlights].sort(
    (a, b) => (a.page ?? Infinity) - (b.page ?? Infinity) || +new Date(a.createdAt) - +new Date(b.createdAt)
  );

  const lines: string[] = [`# ${s.title ?? "Untitled PDF"}`];
  const meta = [s.author, s.publishedDate].filter(Boolean).join(" · ");
  if (meta) lines.push("", meta);
  if (item.citations?.apa) lines.push("", `Source: ${item.citations.apa}`);
  lines.push("", `${highlights.length} highlight${highlights.length === 1 ? "" : "s"}`);

  let lastPage: number | undefined | null = null; // null: nothing written yet
  for (const h of highlights) {
    if (lastPage === null || h.page !== lastPage) {
      lines.push("", h.page ? `## Page ${h.page}` : "## Not tied to a page");
      lastPage = h.page;
    }
    const quote = h.text.trim().split(/\n+/).map((l) => `> ${l.trim()}`);
    quote[0] = quote[0].replace(/^> /, "> \"");
    quote[quote.length - 1] += `"${h.page ? ` (p. ${h.page})` : ""}`;
    lines.push("", ...quote);
    if (h.note?.trim()) lines.push("", `**Note:** ${h.note.trim().replace(/\n+/g, " ")}`);
  }
  return lines.join("\n") + "\n";
}

export function downloadMarkdown(title: string | undefined, markdown: string) {
  const name = (title ?? "owlet").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "owlet";
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-highlights.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}