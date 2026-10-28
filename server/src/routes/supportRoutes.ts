import { Router } from "express";
import rateLimit from "express-rate-limit";
import { sendSupport } from "../controllers/supportController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// 5 messages an hour per account, so the support inbox can't be flooded
const supportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (_req, res) => String(res.locals.userId),
  message: { error: "You've sent a few messages already. Please wait a while before sending another." },
});

router.post("/", supportLimit, sendSupport);

export default router;