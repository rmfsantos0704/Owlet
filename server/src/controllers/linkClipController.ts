import type { Request, Response } from "express";
import { z } from "zod";
import { clip } from "./researchController.js";
import { fetchPage, FetchPageError, type FetchedPage } from "../services/safeFetch.js";
import { fetchViaReader, readerEnabled } from "../services/readerFetch.js";
import { extractPage } from "../services/pageExtract.js";

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), "Only http and https links can be saved."),
  collectionId: z.string().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).optional(),
  personalNote: z.string().trim().max(280).optional(),
  // false = save the page without an AI summary; omitted = AI as before
  useAi: z.boolean().optional(),
});

// Refusals a real browser on another network could plausibly get past (bot checks, rate limits, slow or reset
// connections). A login (401), a missing page, a PDF or a blocked address would fail the same way, so they
// never leave the server.
const READER_STATUSES = new Set([403, 406, 429, 503, 999, 520, 521, 522, 523, 524, 525, 526, 527, 529]);

function shouldTryReader(error: FetchPageError | null): boolean {
  if (!error) return true; // the page downloaded but showed no text: it probably builds its text with JavaScript
  if (error.code === "TIMEOUT" || error.code === "NETWORK") return true;
  return error.code === "HTTP" && error.status !== undefined && READER_STATUSES.has(error.status);
}

// A reader can return the site's bot-check or login page as if it were the article. Refuse those.
const BLOCK_TITLE = /^(just a moment|attention required|access denied|forbidden|403|robot check|are you a robot|security check|one more step|please wait)/i;
const BLOCK_BODY =
  /(verify (that )?you are (a )?human|enable javascript and cookies|checking your browser|unusual traffic|are you a robot|request (has been )?blocked|access (to this page )?(has been )?denied|complete the (security )?check|captcha)/i;

function readerResultUsable(extracted: unknown): boolean {
  const { title = "", rawText = "" } = (extracted ?? {}) as { title?: string; rawText?: string };
  if (rawText.length < 300) return false;
  if (BLOCK_TITLE.test(title.trim())) return false;
  return !(rawText.length < 2500 && BLOCK_BODY.test(rawText.slice(0, 800)));
}

async function tryReader(url: string) {
  if (!readerEnabled()) return null;
  try {
    const page = await fetchViaReader(url);
    const extracted = extractPage(page.html);
    if (!extracted || !readerResultUsable(extracted)) return null;
    return { extracted, finalUrl: page.finalUrl };
  } catch (error) {
    // the address is deliberately not logged
    console.warn("Reader fallback failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

function sendFetchError(res: Response, error: FetchPageError) {
  return res
    .status(error.code === "NETWORK" || error.code === "TIMEOUT" ? 502 : 422)
    .json({ error: error.message, code: error.code });
}

// Saves a page from its address alone: the server downloads it, finds the readable text and details,
// and then goes through exactly the same steps as a clip from the extension (duplicate check, citations, AI summary).
// When the site refuses the download, or the page has no text until its JavaScript runs, a reader service
// is tried before giving up.
export async function clipFromUrl(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paste a web address that starts with http:// or https://", code: "BAD_URL" });
  }
  const { url, collectionId, tags, personalNote, useAi } = parsed.data;

  let page: FetchedPage | null = null;
  let directError: FetchPageError | null = null;
  try {
    page = await fetchPage(url);
  } catch (error) {
    if (!(error instanceof FetchPageError)) throw error;
    directError = error;
  }

  let extracted = page ? extractPage(page.html) : null;
  let finalUrl = page?.finalUrl ?? url;
  let via: "direct" | "reader" = "direct";

  if (!extracted && shouldTryReader(directError)) {
    const viaReader = await tryReader(url);
    if (viaReader) {
      extracted = viaReader.extracted;
      finalUrl = viaReader.finalUrl;
      via = "reader";
    }
  }

  if (!extracted) {
    if (directError) return sendFetchError(res, directError);
    return res.status(422).json({
      error: "Owlet couldn't find readable text on that page. Some pages need a login, or only show their text in a browser.",
      code: "NO_TEXT",
    });
  }

  if (via === "reader") console.info("Page read through the reader fallback");
  res.setHeader("X-Owlet-Read-Via", via); // handy when checking a response in the browser's network tab

  // hand over to the normal clip handler (it skips the AI summary when useAi is false)
  req.body = { ...extracted, url: finalUrl, collectionId, tags, personalNote, useAi };
  return clip(req, res);
}