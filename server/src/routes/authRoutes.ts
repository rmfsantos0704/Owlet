import { Router } from "express";
import {
  register, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword,
} from "../controllers/authController.js";
import { confirmEmailChange } from "../controllers/accountController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/confirm-email-change", confirmEmailChange);
router.get("/me", requireAuth, me);

export default router;