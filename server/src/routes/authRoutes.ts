import { Router } from "express";
import {
  register, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword,
} from "../controllers/authController.js";
import { confirmEmailChange } from "../controllers/accountController.js";
import { requireAuth } from "../middlewares/auth.js";
import { loginPerEmailLimiter } from "../middlewares/rateLimits.js";

const router = Router();

// per-IP limits for every route below are set in app.ts
router.post("/register", register);
router.post("/login", loginPerEmailLimiter, login); // failed logins are also counted per email
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/confirm-email-change", confirmEmailChange);
router.get("/me", requireAuth, me);

export default router;