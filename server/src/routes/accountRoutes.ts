import { Router } from "express";
import {
  getAccount, changePassword, requestEmailChange, cancelEmailChange,
  signOutEverywhere, exportData, deleteAccount,
} from "../controllers/accountController.js";
import { requireAuth } from "../middlewares/auth.js";
import { accountSensitiveLimiter } from "../middlewares/rateLimits.js";

const router = Router();
router.use(requireAuth);

router.get("/", getAccount);
router.post("/password", accountSensitiveLimiter, changePassword); // per-account, on top of the IP limit in app.ts
router.post("/email", accountSensitiveLimiter, requestEmailChange);
router.delete("/email", cancelEmailChange);
router.post("/sign-out-everywhere", signOutEverywhere);
router.get("/export", exportData);
router.post("/delete", accountSensitiveLimiter, deleteAccount); // POST: some clients drop the body on DELETE

export default router;
