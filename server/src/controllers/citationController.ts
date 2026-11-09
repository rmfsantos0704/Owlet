import type { Request, Response } from "express";
import mongoose from "mongoose";
import { collection } from "../models/Collection.js";
import { ResearchItem } from "../models/ResearchItem.js";
import { AiProvidersError, SOURCE_DETAIL_FIELDS, suggestSourceDetails, type SourceSuggestions } from "../services/ai.js";
import { AiOptedOutError, AiQuotaExceededError, refundAiGeneration } from "../services/aiUsage.js";
import { atLeast, roleIn } from "../services/access.js";

const DOI = /\b10\.\d{4,9}\/[^\s"'<>)\]]+/i;

// POST /research/:id/source/suggest
// Proposes the citation details a clip is missing. It changes nothing: the person reviews the suggestions
// and applies them with the normal "edit details" save, which rebuilds the citations.
// A DOI is read straight from the text (no AI). Everything else needs the AI, and is skipped when it is
// off or used up, so the button still works for people who turned AI off.
export async function suggestDetails(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
  const item: any = await ResearchItem.findById(id).select("collectionId source content.rawText").lean();
  if (!item) return res.status(404).json({ error: "Not found" });

  const ws = await collection.findById(item.collectionId).select("ownerId members");
  const role = ws ? roleIn(ws, res.locals.userId) : null;
  if (!role) return res.status(404).json({ error: "Not found" });
  if (!atLeast(role, "editor")) return res.status(403).json({ error: "Only editors can change a source's details." });

  const source = item.source ?? {};
  const have = (field: string) =>
    field === "author" ? !!(source.author || source.authors?.length) : !!String(source[field] ?? "").trim();
  const missing = SOURCE_DETAIL_FIELDS.filter((f) => !have(f));
  const text = String(item.content?.rawText ?? "").slice(0, 8000);

  const suggestions: SourceSuggestions = {};
  let ai: "used" | "off" | "quota" | "failed" | "skipped" = "skipped";
  if (!missing.length || !text.trim()) return res.json({ suggestions, ai });

  if (missing.includes("doi")) {
    const found = text.match(DOI)?.[0]?.replace(/[.,;:]+$/, "");
    if (found) suggestions.doi = found;
  }

  const forAi = missing.filter((f) => !suggestions[f]);
  if (forAi.length) {
    const userId = String(res.locals.userId);
    try {
      Object.assign(suggestions, await suggestSourceDetails(userId, { title: source.title ?? "", text, missing: forAi }));
      ai = "used";
    } catch (err) {
      if (err instanceof AiOptedOutError) ai = "off";
      else if (err instanceof AiQuotaExceededError) ai = "quota";
      else {
        console.error("Suggesting citation details failed:", err);
        ai = "failed";
        if (err instanceof AiProvidersError) await refundAiGeneration(userId).catch(() => {});
      }
    }
  }
  res.json({ suggestions, ai });
}