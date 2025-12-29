import { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

async function resolveUser(token: string) {
  const { sub } = verifyToken(token);
  return prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, username: true, email: true, createdAt: true },
  });
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (!token) throw new AppError(401, "UNAUTHORIZED", "Authorization token required");
    const user = await resolveUser(token);
    if (!user) throw new AppError(401, "UNAUTHORIZED", "User not found");
    req.user = user;
  } catch (err) {
    const appErr =
      err instanceof AppError ? err : new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
    reply.status(appErr.statusCode).send({ error: { code: appErr.code, message: appErr.message } });
  }
}

export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      const user = await resolveUser(token);
      if (user) req.user = user;
    }
  } catch {
    // ignore — auth is optional
  }
}
