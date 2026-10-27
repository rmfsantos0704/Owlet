import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  clip, importPdf, list, getOne, remove,
  addHighlight, removeHighlight, addComment, removeComment, setTags,
  updateSource, regenerate, pdf, exportItems,
} from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadPdf } from "../middlewares/upload.js";
import { clipDailyLimiter, importDailyLimiter, writeLimiter } from "../middlewares/rateLimits.js";
import { trackActivity } from "../middlewares/trackActivity.js";

const router = Router();
router.use(requireAuth);

const regenLimit = rateLimit({ windowMs: 60 * 1000, limit: 15 });

// per-minute IP limits for clip/import are in app.ts; these add a daily cap per account
router.post("/clip", clipDailyLimiter, trackActivity("clip_added"), clip);
router.post("/import", importDailyLimiter, uploadPdf, trackActivity("pdf_imported"), importPdf);
router.get("/", list);
router.get("/export", exportItems);
router.get("/:id", getOne);
router.delete("/:id", writeLimiter, remove);
router.get("/:id/pdf", pdf);

router.post("/:id/regenerate", regenLimit, regenerate);
router.patch("/:id/source", writeLimiter, updateSource);
router.post("/:id/highlights", writeLimiter, trackActivity("highlight_added"), addHighlight);
router.delete("/:id/highlights/:highlightId", writeLimiter, removeHighlight);
router.post("/:id/comments", writeLimiter, trackActivity("comment_added"), addComment);
router.delete("/:id/comments/:commentId", writeLimiter, removeComment);
router.put("/:id/tags", writeLimiter, setTags);

export default router;