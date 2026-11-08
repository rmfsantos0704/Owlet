import { Router } from "express";
import { listBriefs, getBrief, briefPdf, createBrief, updateBrief, removeBrief } from "../controllers/briefController.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireAi } from "../middlewares/requireAi.js";
import { aiDailyLimiter, aiMinuteLimiter, writeLimiter } from "../middlewares/rateLimits.js";

const router = Router();
router.use(requireAuth);

router.get("/", listBriefs);
router.post("/", requireAi, aiMinuteLimiter, aiDailyLimiter, createBrief);
router.get("/:id", getBrief);
router.get("/:id/pdf", briefPdf);
router.patch("/:id", writeLimiter, updateBrief);
router.delete("/:id", writeLimiter, removeBrief);

export default router;