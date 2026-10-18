import { Router } from "express";
import {
  clip, list, getOne, remove,
  addHighlight, removeHighlight, addComment, removeComment, setTags,
  pdf, exportItems,
} from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/clip", clip);
router.get("/", list);
router.get("/export", exportItems);
router.get("/:id", getOne);
router.delete("/:id", remove);
router.get("/:id/pdf", pdf);

router.post("/:id/highlights", addHighlight);
router.delete("/:id/highlights/:highlightId", removeHighlight);
router.post("/:id/comments", addComment);
router.delete("/:id/comments/:commentId", removeComment);
router.put("/:id/tags", setTags);

export default router;