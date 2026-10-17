import { Router } from "express";
import { clip, list, getOne, remove } from "../controllers/researchController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/clip", clip);
router.get("/", list);
router.get("/:id", getOne);
router.delete("/:id", remove);

export default router;