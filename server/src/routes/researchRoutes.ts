import { Router } from "express";
import {
  clip, importPdf, list, getOne, remove,
  addHighlight, updateHighlight, removeHighlight,
  addComment, updateComment, removeComment,
  setTags, updateSource, regenerate, pdf, exportItems,
  ask, listSessions, removeSession, renameSession,
  testAi, setAiSettings,
} from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadPdf } from "../middlewares/upload.js";
import {
  aiDailyLimiter, aiMinuteLimiter, clipDailyLimiter, importDailyLimiter, writeLimiter,
} from "../middlewares/rateLimits.js";
import { trackActivity } from "../middlewares/trackActivity.js";

const router = Router();
router.use(requireAuth); // the per-account limiters below rely on this having run first

// per-minute IP limits for clip/import are in app.ts; these add a daily cap per account
router.post("/clip", clipDailyLimiter, trackActivity("clip_added"), clip);
router.post("/import", importDailyLimiter, uploadPdf, trackActivity("pdf_imported"), importPdf);
router.post("/ask", aiMinuteLimiter, aiDailyLimiter, ask);
router.get("/sessions", listSessions);
router.patch("/sessions/:id", writeLimiter, renameSession);
router.delete("/sessions/:id", writeLimiter, removeSession);
router.get("/", list);
router.get("/export", exportItems);
router.get("/:id", getOne);
router.delete("/:id", writeLimiter, remove);
router.get("/:id/pdf", pdf);

router.post("/:id/regenerate", aiMinuteLimiter, aiDailyLimiter, regenerate);
router.post("/:id/test-ai", aiMinuteLimiter, aiDailyLimiter, testAi);
router.patch("/:id/source", writeLimiter, updateSource);
router.post("/:id/highlights", writeLimiter, trackActivity("highlight_added"), addHighlight);
router.patch("/:id/highlights/:highlightId", writeLimiter, updateHighlight);
router.delete("/:id/highlights/:highlightId", writeLimiter, removeHighlight);
router.post("/:id/comments", writeLimiter, trackActivity("comment_added"), addComment);
router.patch("/:id/comments/:commentId", writeLimiter, updateComment);
router.delete("/:id/comments/:commentId", writeLimiter, removeComment);
router.put("/:id/tags", writeLimiter, setTags);
router.put("/:id/ai-settings", writeLimiter, setAiSettings);
export default router;