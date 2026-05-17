import { FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { LoginInput, SignupInput, userResponseSchema, authResponseSchema } from "../schemas/auth.schemas";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
}

function safeUsername(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.slice(0, 40) || "user";
}

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

export async function googleInit(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!googleConfigured()) {
    await googleNotConfigured(_req, reply);
    return;
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
  });

  reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export async function googleCallback(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!googleConfigured()) {
    await googleNotConfigured(req, reply);
    return;
  }

  const { code } = req.query as { code?: string };
  if (!code) throw new AppError(400, "VALIDATION_ERROR", "Missing authorization code");

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new AppError(500, "INTERNAL_ERROR", "Failed to exchange OAuth code");

  const tokenBody = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenBody.access_token) throw new AppError(500, "INTERNAL_ERROR", "Google did not return an access token");

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  if (!userInfoResponse.ok) throw new AppError(500, "INTERNAL_ERROR", "Failed to fetch user info from Google");

  const info = (await userInfoResponse.json()) as { email?: string; name?: string; given_name?: string; sub?: string };
  const email = info.email?.toLowerCase();
  if (!email) throw new AppError(500, "INTERNAL_ERROR", "Google account did not include an email");

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) return existing;

    const base = safeUsername(info.name ?? info.given_name ?? email.split("@")[0]);
    let username = base;
    let suffix = 1;
    while (await tx.user.findUnique({ where: { username } })) {
      username = `${base}_${suffix++}`;
    }

    return tx.user.create({ data: { email, username, password: null } });
  });

  reply.redirect(`${env.FRONTEND_URL}/auth/callback?token=${signToken(user.id)}`);
}
