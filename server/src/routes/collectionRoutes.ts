import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "../controllers/collectionController.js";
import * as inv from "../controllers/invitationController.js";
import * as jl from "../controllers/joinLinkController.js";
import * as act from "../controllers/activityController.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  inviteHourlyLimiter, inviteMinuteLimiter, joinLinkManageLimiter, joinLinkUseLimiter, writeLimiter,
} from "../middlewares/rateLimits.js";

const router = Router();
router.use(requireAuth);

router.get("/", c.listcollections);
router.post("/", writeLimiter, c.createcollection);

// the signed-in person's own invitations; these must stay above "/:id" or "invitations" would be read as an id
router.get("/invitations", inv.listMine);
router.post("/invitations/:invId/accept", inv.accept);
router.post("/invitations/:invId/decline", inv.decline);

// notifications bell; must stay above "/:id" or "notifications" would be read as an id
router.get("/notifications", act.listNotifications);
router.post("/notifications/read", writeLimiter, act.markNotificationsRead);

// join links: opening one only shows a confirmation screen; POST is what actually adds the person
router.get("/join/:token", joinLinkUseLimiter, jl.previewJoin);
router.post("/join/:token", joinLinkUseLimiter, jl.confirmJoin);

router.get("/:id", c.getcollection);
router.get("/:id/activity", act.listActivity);
router.patch("/:id", writeLimiter, c.updatecollection);
router.delete("/:id", writeLimiter, c.deletecollection);

router.get("/:id/export-pdf", rateLimit({ windowMs: 60 * 1000, limit: 10 }), c.exportPdf);
router.post("/:id/test-ai", rateLimit({ windowMs: 60 * 1000, limit: 10 }), c.testAi);

// sends an invitation: 20 a minute and 30 an hour per owner, so invite -> cancel -> invite can't be used to spam
router.post("/:id/members", inviteMinuteLimiter, inviteHourlyLimiter, c.addMember);
router.patch("/:id/members/:userId", writeLimiter, c.setMemberRole);
router.delete("/:id/members/:userId", writeLimiter, c.removeMember);

router.get("/:id/invitations", c.listInvitations);
router.delete("/:id/invitations/:invId", writeLimiter, c.cancelInvitation);

router.post("/:id/join-link", joinLinkManageLimiter, jl.createJoinLink);
router.delete("/:id/join-link", joinLinkManageLimiter, jl.revokeJoinLink);

export default router;