import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema, signupSchema } from "../schemas/auth.schemas";
import { login, signup, me, googleNotConfigured, googleCallback } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", validateBody(signupSchema), signup);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", requireAuth, me);
router.get("/google", googleNotConfigured);
router.get("/google/callback", googleCallback);

export default router;
