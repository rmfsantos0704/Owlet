import { Router } from "express";
import * as c from "../controllers/workspaceController.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", c.listWorkspaces);
router.post("/", c.createWorkspace);
router.get("/:id", c.getWorkspace);
router.patch("/:id", c.updateWorkspace);
router.delete("/:id", c.deleteWorkspace);

router.post("/:id/members", c.addMember);
router.patch("/:id/members/:userId", c.setMemberRole);
router.delete("/:id/members/:userId", c.removeMember);

export default router;