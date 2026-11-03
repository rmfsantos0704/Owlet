import { Router } from "express";
import {
  clip, importPdf, list, lookup, getOne, getHighlights, remove,
  addHighlight, updateHighlight, removeHighlight,
  addComment, updateComment, removeComment,
  setTags, updateSource, regenerate, pdf, exportItems, setAiOutput,
  updateWorkflow, updateMatrixValue, related,
  ask, listSessions, removeSession, renameSession,
  testAi, setAiSettings,
} from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireAi } from "../middlewares/requireAi.js";
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
router.post("/ask", requireAi, aiMinuteLimiter, aiDailyLimiter, ask);
router.get("/sessions", listSessions); // stays open so old sessions can still be deleted
router.patch("/sessions/:id", writeLimiter, renameSession);
router.delete("/sessions/:id", writeLimiter, removeSession);
router.get("/", list);
router.get("/export", exportItems);
router.get("/lookup", writeLimiter, lookup);
router.get("/:id", getOne);
router.get("/:id/related", related);
router.get("/:id/highlights", getHighlights);
router.delete("/:id", writeLimiter, remove);
router.get("/:id/pdf", pdf);

router.post("/:id/regenerate", requireAi, aiMinuteLimiter, aiDailyLimiter, regenerate);
router.post("/:id/test-ai", requireAi, aiMinuteLimiter, aiDailyLimiter, testAi);
router.patch("/:id/source", writeLimiter, updateSource);
router.patch("/:id/workflow", writeLimiter, updateWorkflow);
router.patch("/:id/matrix", writeLimiter, updateMatrixValue);
router.post("/:id/highlights", writeLimiter, trackActivity("highlight_added"), addHighlight);
router.patch("/:id/highlights/:highlightId", writeLimiter, updateHighlight);
router.delete("/:id/highlights/:highlightId", writeLimiter, removeHighlight);
router.post("/:id/comments", writeLimiter, trackActivity("comment_added"), addComment);
router.patch("/:id/comments/:commentId", writeLimiter, updateComment);
router.delete("/:id/comments/:commentId", writeLimiter, removeComment);
router.put("/:id/tags", writeLimiter, setTags);
router.put("/:id/ai-settings", requireAi, writeLimiter, setAiSettings);
router.patch("/:id/ai-output", writeLimiter, setAiOutput);
export default router;