import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { LoginInput, SignupInput, userResponseSchema, authResponseSchema } from "../schemas/auth.schemas";

// Express 5 automatically catches errors thrown in async handlers and forwards
// them to the error handler — no try/catch or next(err) needed.

export async function login(req: Request, res: Response): Promise<void> {
  const { email: rawEmail, password } = req.body as LoginInput;
  const email = rawEmail.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const accessToken = signToken(user.id);
  logger.info("User logged in", { userId: user.id });

  res.json(authResponseSchema.parse({ user, accessToken }));
}

export async function signup(req: Request, res: Response): Promise<void> {
  const { username, email, password } = req.body as SignupInput;
  const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const [existingEmail, existingUsername] = await Promise.all([
      tx.user.findUnique({ where: { email }, select: { id: true } }),
      tx.user.findUnique({ where: { username }, select: { id: true } }),
    ]);
    if (existingEmail) throw new AppError(409, "CONFLICT", "Email is already taken");
    if (existingUsername) throw new AppError(409, "CONFLICT", "Username is already taken");
    return tx.user.create({ data: { username, email, password: hashedPassword } });
  });

  const accessToken = signToken(user.id);
  logger.info("User registered", { userId: user.id });

  res.status(201).json(authResponseSchema.parse({ user, accessToken }));
}

export function me(req: Request, res: Response): void {
  res.json(userResponseSchema.parse(req.user));
}

export function googleCallback(req: Request, res: Response): void {
  const user = req.user as { id: string } | undefined;
  if (!user) {
    res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    return;
  }
  const token = signToken(user.id);
  res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
}

export function googleNotConfigured(_req: Request, res: Response): void {
  res.status(501).json({
    error: { code: "NOT_CONFIGURED", message: "Google OAuth is not configured on this server" },
  });
}
