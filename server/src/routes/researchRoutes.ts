import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  clip, importPdf, list, getOne, remove,
  addHighlight, removeHighlight, addComment, removeComment, setTags,
  updateSource, regenerate, pdf, exportItems,
} from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";
import { uploadPdf } from "../middlewares/upload.js";

const router = Router();
router.use(requireAuth);

const regenLimit = rateLimit({ windowMs: 60 * 1000, limit: 15 });

router.post("/clip", clip);
router.post("/import", uploadPdf, importPdf);
router.get("/", list);
router.get("/export", exportItems);
router.get("/:id", getOne);
router.delete("/:id", remove);
router.get("/:id/pdf", pdf);

router.post("/:id/regenerate", regenLimit, regenerate);
router.patch("/:id/source", updateSource);
router.post("/:id/highlights", addHighlight);
router.delete("/:id/highlights/:highlightId", removeHighlight);
router.post("/:id/comments", addComment);
router.delete("/:id/comments/:commentId", removeComment);
router.put("/:id/tags", setTags);

export default router;