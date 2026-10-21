import { extractText, getDocumentProxy, getMeta } from "unpdf";

export class PdfImportError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

// Titles like "Microsoft Word - draft.docx" are export leftovers, not real titles
const JUNK_TITLE = /^(untitled|microsoft word|document\d*|slide \d+)\b|\.(docx?|pdf|tex|pptx?)$/i;

function tidy(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/-\n(?=[a-z])/g, "") // re-join words hyphenated across lines
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(buffer: Buffer, fileName: string) {
  let pdf;
  try {
    // unpdf wants a plain Uint8Array, not a Node Buffer
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err: any) {
    if (err?.name === "PasswordException") throw new PdfImportError("This PDF is password-protected.");
    throw new PdfImportError("This file isn't a readable PDF.", 400);
  }

  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const meta = await getMeta(pdf).catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;

  const fallbackTitle = fileName.replace(/\.pdf$/i, "").replace(/_+/g, " ").trim() || "Untitled PDF";
  const rawTitle = typeof info.Title === "string" ? info.Title.trim() : "";
  const rawAuthor = typeof info.Author === "string" ? info.Author.trim() : "";

  return {
    pages: totalPages,
    text: tidy(text),
    title: (rawTitle && !JUNK_TITLE.test(rawTitle) ? rawTitle : fallbackTitle).slice(0, 500),
    author: rawAuthor ? rawAuthor.slice(0, 200) : undefined,
  };
}