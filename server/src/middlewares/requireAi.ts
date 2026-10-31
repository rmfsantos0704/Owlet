import type { NextFunction, Request, Response } from "express";
import { aiEnabled } from "../config/features.js";

// Put this on any route that calls the AI provider.
export function requireAi(_req: Request, res: Response, next: NextFunction) {
  if (!aiEnabled()) return res.status(404).json({ error: "AI features are turned off." });
  next();
}