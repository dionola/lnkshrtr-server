import { Router } from "express";
import passport from "passport";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema, signupSchema } from "../schemas/auth.schemas";
import { login, signup, me, googleNotConfigured, googleCallback } from "../controllers/auth.controller";

const router = Router();

router.post("/signup", validateBody(signupSchema), signup);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", requireAuth, me);

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
  router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed`, session: false }),
    googleCallback
  );
} else {
  router.get("/google", googleNotConfigured);
  router.get("/google/callback", googleNotConfigured);
}

export default router;
