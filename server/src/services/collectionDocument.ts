import { groupByTopic } from "./collectionPdf.js";

const MAX_DOCUMENT_CHARS = 900_000;
const MAX_PER_ITEM = 100;
const MAX_TEXT = 1500;
const STYLES = [
  { key: "apa", label: "APA" },
  { key: "mla", label: "MLA" },
  { key: "chicago", label: "Chicago" },
] as const;

const cut = (value: unknown) => String(value ?? "").slice(0, MAX_TEXT);
const formatDate = (value: unknown) => {
  const date = value instanceof Date
    ? value
    : new Date(typeof value === "string" || typeof value === "number" ? value : Number.NaN);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

export function collectionDocument(
  ws: { name: string; description?: string },
  items: any[],
  mode: "full" | "citations",
  omitted: number
) {
  const topics = groupByTopic(items);
  const chunks: string[] = [];
  let length = 0;
  let truncated = false;

  const add = (value = "") => {
    if (truncated) return;
    const line = `${value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")}\n`;
    if (length + line.length > MAX_DOCUMENT_CHARS) {
      truncated = true;
      return;
    }
    chunks.push(line);
    length += line.length;
  };

  add(ws.name || "Collection");
  add(mode === "full" ? "Research report" : "Citation list");
  if (ws.description?.trim()) add(ws.description.trim());
  add(`${items.length} ${items.length === 1 ? "source" : "sources"} · ${topics.length} ${topics.length === 1 ? "topic" : "topics"} · Generated ${formatDate(new Date())}`);
  if (omitted > 0) add(`Showing the ${items.length} most recent of ${items.length + omitted} clips.`);

  if (mode === "full") {
    add();
    add("Sources by topic");
    for (const { topic, items: topicItems } of topics) {
      add();
      add(`${topic} (${topicItems.length})`);
      const sorted = [...topicItems].sort((a, b) =>
        String(a.source?.title ?? "").localeCompare(String(b.source?.title ?? ""), undefined, { sensitivity: "base" })
      );
      for (const item of sorted) {
        const source = item.source ?? {};
        add();
        add(cut(source.title || source.fileName || source.url || "Untitled"));
        const origin = source.kind === "pdf" ? `PDF${source.fileName ? ` · ${source.fileName}` : ""}` : source.domain;
        const metadata = [source.author, source.publishedDate, origin].filter(Boolean).map(cut).join(" · ");
        if (metadata) add(metadata);
        if (source.url) add(cut(source.url));
        if (item.tags?.length) add(item.tags.map((tag: unknown) => `#${cut(tag)}`).join("  "));
        if (item.aiOutput?.summary) {
          add("Summary");
          add(cut(item.aiOutput.summary));
        }
        if (item.aiOutput?.paraphrase) {
          add("Key arguments");
          add(cut(item.aiOutput.paraphrase));
        }
        if (item.highlights?.length) {
          add("Highlights");
          for (const highlight of item.highlights.slice(0, MAX_PER_ITEM)) {
            add(`• "${cut(highlight.text)}"`);
            if (highlight.note) add(`  Note: ${cut(highlight.note)}`);
          }
          if (item.highlights.length > MAX_PER_ITEM) add(`... and ${item.highlights.length - MAX_PER_ITEM} more highlights`);
        }
        if (item.comments?.length) {
          add("Comments");
          for (const comment of item.comments.slice(0, MAX_PER_ITEM)) {
            const by = [comment.authorEmail, formatDate(comment.createdAt)].filter(Boolean).join(" · ");
            add(by ? `${cut(comment.text)} (${cut(by)})` : cut(comment.text));
          }
          if (item.comments.length > MAX_PER_ITEM) add(`... and ${item.comments.length - MAX_PER_ITEM} more comments`);
        }
      }
    }
  }

  add();
  add("Citations by style");
  for (const style of STYLES) {
    add();
    add(style.label);
    for (const { topic, items: topicItems } of topics) {
      add();
      add(`${topic} (${topicItems.length})`);
      const entries = topicItems
        .map((item) => cut(item.citations?.[style.key] ?? "").trim() || "(No citation available)")
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
      entries.forEach(add);
    }
  }

  const truncationNotice = "\n[The report was shortened to fit Google Docs export limits.]\n";
  let text = chunks.join("");
  if (truncated) text = text.slice(0, MAX_DOCUMENT_CHARS - truncationNotice.length) + truncationNotice;
  return { text, truncated };
}
