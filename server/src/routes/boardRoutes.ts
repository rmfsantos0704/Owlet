import { Router } from "express";
import {
  getBoard, setMainQuestion, addQuestion, updateQuestion, removeQuestion,
  addLinks, updateLink, removeLink,
} from "../controllers/boardController.js";
import { requireAuth } from "../middlewares/auth.js";
import { writeLimiter } from "../middlewares/rateLimits.js";

const router = Router();
router.use(requireAuth);

router.get("/:collectionId", getBoard);
router.put("/:collectionId/main", writeLimiter, setMainQuestion);
router.post("/:collectionId/questions", writeLimiter, addQuestion);
router.post("/:collectionId/links", writeLimiter, addLinks);
router.patch("/questions/:id", writeLimiter, updateQuestion);
router.delete("/questions/:id", writeLimiter, removeQuestion);
router.patch("/links/:id", writeLimiter, updateLink);
router.delete("/links/:id", writeLimiter, removeLink);

export default router;