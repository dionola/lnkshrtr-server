import { Router } from "express";
import { validateQuery } from "../middleware/validate";
import { getPublicLinksQuerySchema } from "../schemas/links.schemas";
import { getPublicUser, getPublicLinks } from "../controllers/public.controller";

const router = Router();

router.get("/:username", getPublicUser);
router.get("/:username/links", validateQuery(getPublicLinksQuerySchema), getPublicLinks);

export default router;
