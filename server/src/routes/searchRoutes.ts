import { Router } from "express";
import rateLimit from "express-rate-limit";
import { semanticSearch, indexLibrary } from "../controllers/searchController.js";
import { requireAuth } from "../middlewares/auth.js";

// every search and indexing call uses the embeddings provider, so each is capped per visitor
const limiter = (limit: number) =>
  rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many searches. Please wait a little and try again." },
  });

const router = Router();
router.use(requireAuth);

router.get("/", limiter(20), semanticSearch);
router.post("/index", limiter(30), indexLibrary);

export default router;