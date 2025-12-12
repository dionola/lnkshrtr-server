import { Request, Response, NextFunction } from "express";
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Authorization token required");
    }
    const user = await resolveUser(token);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found");
    }
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      const user = await resolveUser(token);
      if (user) req.user = user;
    }
    next();
  } catch {
    next();
  }
}
