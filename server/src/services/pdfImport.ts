import { extractText, getDocumentProxy, getMeta } from "unpdf";

export class PdfImportError extends Error {
  constructor(message: string, public status = 422) {
    super(message);
  }
}

const MAX_PAGES = 500; // a bigger "PDF" is far more likely to be an attack than a paper
const MAX_RAW_CHARS = 2_000_000; // Owlet keeps 200,000, so this is already generous
const EXTRACT_TIMEOUT_MS = 30_000;

// Titles like "Microsoft Word - draft.docx" are export leftovers, not real titles
const JUNK_TITLE = /^(untitled|microsoft word|document\d*|slide \d+)\b|\.(docx?|pdf|tex|pptx?)$/i;

function tidy(text: string) {
  return text
    .replace(/\r/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // control characters
    .replace(/-\n(?=[a-z])/g, "") // re-join words hyphenated across lines
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfImportError("This PDF took too long to read. Try a smaller file.")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new PdfImportError(`This PDF has ${pdf.numPages} pages. The limit is ${MAX_PAGES}.`);
    }

    const { totalPages, text } = await withTimeout(extractText(pdf, { mergePages: true }), EXTRACT_TIMEOUT_MS);
    const meta = await getMeta(pdf).catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;

    const fallbackTitle = fileName.replace(/\.pdf$/i, "").replace(/_+/g, " ").trim() || "Untitled PDF";
    const rawTitle = typeof info.Title === "string" ? info.Title.trim() : "";
    const rawAuthor = typeof info.Author === "string" ? info.Author.trim() : "";

    return {
      pages: totalPages,
      text: tidy(String(text ?? "").slice(0, MAX_RAW_CHARS)),
      title: (rawTitle && !JUNK_TITLE.test(rawTitle) ? rawTitle : fallbackTitle).slice(0, 500),
      author: rawAuthor ? rawAuthor.slice(0, 200) : undefined,
    };
  } catch (err) {
    if (err instanceof PdfImportError) throw err;
    throw new PdfImportError("We couldn't read the text in this PDF.");
  } finally {
    try {
      // not every unpdf version types this method, so call it through a cast
      await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
    } catch {
      /* freeing memory is best effort */
    }
  }
}