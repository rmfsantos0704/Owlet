import { Router } from "express";
import { listBriefs, getBrief, briefPdf, createBrief, updateBrief, removeBrief } from "../controllers/briefController.js";
import { requireAuth } from "../middlewares/auth.js";
import { writeLimiter } from "../middlewares/rateLimits.js";

const router = Router();
router.use(requireAuth);

router.get("/", listBriefs);
// No requireAi here: when AI is off or used up, createBrief builds an outline without AI instead.
// The AI allowance is still enforced inside composeBrief (reserveAiGeneration).
router.post("/", writeLimiter, createBrief);
router.get("/:id", getBrief);
router.get("/:id/pdf", briefPdf);
router.patch("/:id", writeLimiter, updateBrief);
router.delete("/:id", writeLimiter, removeBrief);

export default router;