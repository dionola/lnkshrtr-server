import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createLinkSchema,
  updateLinkSchema,
  verifyPasswordSchema,
  getUserLinksQuerySchema,
} from "../schemas/links.schemas";
import {
  getUserLinks,
  createLink,
  updateLink,
  deleteLink,
  getLinkByCode,
  verifyPassword,
  recordClick,
} from "../controllers/links.controller";

const router = Router();

router.get("/", requireAuth, validateQuery(getUserLinksQuerySchema), getUserLinks);
router.post("/", optionalAuth, validateBody(createLinkSchema), createLink);
router.put("/:id", requireAuth, validateBody(updateLinkSchema), updateLink);
router.delete("/:id", requireAuth, deleteLink);
router.get("/code/:shortCode", getLinkByCode);
router.post("/code/:shortCode", validateBody(verifyPasswordSchema), verifyPassword);
router.post("/code/:shortCode/click", recordClick);

export default router;
