import type { NextFunction, Request, Response } from "express";
import { aiEnabled } from "../config/features.js";
import { aiOptedOut } from "../services/aiUsage.js";

// Put this on any route that calls the AI provider (after requireAuth).
export async function requireAi(_req: Request, res: Response, next: NextFunction) {
  if (!aiEnabled()) return res.status(404).json({ error: "AI features are turned off." });
  if (await aiOptedOut(String(res.locals.userId))) {
    return res.status(403).json({
      error: "You turned off AI features in your account. You can turn them back on in Account settings.",
      code: "AI_OFF_BY_USER",
    });
  }
  next();
}