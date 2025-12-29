import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { LoginInput, SignupInput, userResponseSchema, authResponseSchema } from "../schemas/auth.schemas";

export async function signup(req: FastifyRequest, reply: FastifyReply): Promise<void> {
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
  reply.status(201).send(authResponseSchema.parse({ user, accessToken }));
}

export async function login(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { email: rawEmail, password } = req.body as LoginInput;
  const email = rawEmail.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const accessToken = signToken(user.id);
  logger.info("User logged in", { userId: user.id });
  reply.send(authResponseSchema.parse({ user, accessToken }));
}

export async function me(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.send(userResponseSchema.parse(req.user));
}

export async function googleNotConfigured(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(501).send({
    error: { code: "NOT_CONFIGURED", message: "Google OAuth is not configured on this server" },
  });
}

export async function googleCallback(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.status(501).send({
    error: { code: "NOT_CONFIGURED", message: "Google OAuth is not configured on this server" },
  });
}
