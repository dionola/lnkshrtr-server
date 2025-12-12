import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { env } from "./env";

export function configurePassport(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: unknown, user?: Express.User | false) => void
      ) => {
        try {
          const email =
            profile.emails?.[0]?.value ?? `${profile.id}@google.oauth`;

          const user = await prisma.$transaction(async (tx) => {
            const existing = await tx.user.findUnique({ where: { email } });
            if (existing) return existing;

            const baseUsername =
              profile.displayName?.toLowerCase().replace(/\s+/g, "_") ??
              `user_${profile.id.slice(0, 8)}`;

            let username = baseUsername;
            let suffix = 1;
            while (await tx.user.findUnique({ where: { username } })) {
              username = `${baseUsername}_${suffix++}`;
            }

            return tx.user.create({
              data: { email, username, password: null },
            });
          });

          logger.info("Google OAuth login", { userId: user.id });
          done(null, user as unknown as Express.User);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}
