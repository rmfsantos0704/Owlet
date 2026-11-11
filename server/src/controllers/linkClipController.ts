import type { Request, Response } from "express";
import { z } from "zod";
import { clip } from "./researchController.js";
import { fetchPage, FetchPageError } from "../services/safeFetch.js";
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
});

// Saves a page from its address alone: the server downloads it, finds the readable text and details,
// and then goes through exactly the same steps as a clip from the extension (duplicate check, citations, AI summary).
export async function clipFromUrl(req: Request, res: Response) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paste a web address that starts with http:// or https://", code: "BAD_URL" });
  }
  const { url, collectionId, tags, personalNote } = parsed.data;

  let page;
  try {
    page = await fetchPage(url);
  } catch (error) {
    if (error instanceof FetchPageError) {
      return res.status(error.code === "NETWORK" || error.code === "TIMEOUT" ? 502 : 422).json({ error: error.message, code: error.code });
    }
    throw error;
  }

const extracted = await extractPage(page.html);
  if (!extracted) {
    return res.status(422).json({
      error: "Owlet couldn't find readable text on that page. Some pages need a login, or only show their text in a browser.",
      code: "NO_TEXT",
    });
  }

  // hand over to the normal clip handler
  req.body = { ...extracted, url: page.finalUrl, collectionId, tags, personalNote };
  return clip(req, res);
}