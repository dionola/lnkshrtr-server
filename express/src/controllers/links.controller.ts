import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { generateUniqueShortCode } from "../lib/shortCode";
import {
  CreateLinkInput,
  UpdateLinkInput,
  VerifyPasswordInput,
  GetUserLinksQuery,
  linkResponseSchema,
} from "../schemas/links.schemas";
import { routeParam } from "../lib/routeParam";

function extractTitle(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 50);
  }
}

export async function getLinkByCode(req: Request, res: Response): Promise<void> {
  const shortCode = routeParam(req, "shortCode");

  const cached = await cache.getLinkByCode(shortCode);
  if (cached) { res.json(cached); return; }

  const link = await prisma.link.findUnique({ where: { shortCode } });
  if (!link) throw new AppError(404, "NOT_FOUND", "Short code not found");

  const response = linkResponseSchema.parse(link);
  await cache.setLinkByCode(shortCode, response);
  res.json(response);
}

export function recordClick(req: Request, res: Response): void {
  const shortCode = routeParam(req, "shortCode");

  prisma.link
    .update({ where: { shortCode }, data: { visits: { increment: 1 } } })
    .then(() => cache.invalidateLinkByCode(shortCode))
    .catch((err) => logger.warn("Failed to increment visit count", { shortCode, error: (err as Error).message }));

  res.json({});
}

export async function verifyPassword(req: Request, res: Response): Promise<void> {
  const { password } = req.body as VerifyPasswordInput;
  const shortCode = routeParam(req, "shortCode");

  const link = await prisma.link.findUnique({
    where: { shortCode },
    select: { password: true, isPasswordProtected: true },
  });

  if (!link) throw new AppError(404, "NOT_FOUND", "Short code not found");

  if (!link.isPasswordProtected || !link.password) { res.json(true); return; }

  res.json(await bcrypt.compare(password, link.password));
}

export async function createLink(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateLinkInput;
  const userId = req.user?.id ?? null;

  const shortCode = body.customCode ?? (await generateUniqueShortCode());
  const hashedPassword =
    body.isPasswordProtected && body.password
      ? await bcrypt.hash(body.password, env.BCRYPT_ROUNDS)
      : null;

  const link = await prisma.$transaction(async (tx) => {
    if (body.customCode) {
      const exists = await tx.link.findUnique({ where: { shortCode }, select: { id: true } });
      if (exists) throw new AppError(409, "CONFLICT", "Short code is already in use");
    }
    return tx.link.create({
      data: {
        shortCode,
        originalUrl: body.url,
        title: extractTitle(body.url),
        isPublic: body.isPublic,
        isPasswordProtected: body.isPasswordProtected,
        password: hashedPassword,
        userId,
        type: body.type,
      },
    });
  });

  if (userId) await cache.invalidateUserLinks(userId);
  logger.info("Link created", { linkId: link.id, userId, shortCode: link.shortCode });

  res.status(201).json(linkResponseSchema.parse(link));
}

export async function getUserLinks(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { type } = req.query as GetUserLinksQuery;

  const cacheKey = type ? `${userId}:${type}` : userId;
  const cached = await cache.getUserLinks(cacheKey);
  if (cached) { res.json(cached); return; }

  const links = await prisma.link.findMany({
    where: { userId, ...(type && { type }) },
    orderBy: { createdAt: "desc" },
  });

  const response = links.map((l) => linkResponseSchema.parse(l));
  await cache.setUserLinks(cacheKey, response);
  res.json(response);
}

export async function updateLink(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateLinkInput;
  const user = req.user!;
  const id = routeParam(req, "id");

  const newPasswordHash =
    body.isPasswordProtected && body.password
      ? await bcrypt.hash(body.password, env.BCRYPT_ROUNDS)
      : null;

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.link.findUnique({ where: { id }, select: { userId: true, shortCode: true } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Link not found");
    if (existing.userId !== user.id) throw new AppError(403, "FORBIDDEN", "You do not own this link");

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.isPasswordProtected !== undefined) {
      updateData.isPasswordProtected = body.isPasswordProtected;
      if (body.isPasswordProtected && newPasswordHash) updateData.password = newPasswordHash;
      else if (!body.isPasswordProtected) updateData.password = null;
    }

    return tx.link.update({ where: { id }, data: updateData });
  });

  await cache.invalidateAll({ linkCode: link.shortCode, userId: user.id });
  logger.info("Link updated", { linkId: link.id, userId: user.id });
  res.json(linkResponseSchema.parse(link));
}

export async function deleteLink(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const id = routeParam(req, "id");

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.link.findUnique({ where: { id }, select: { userId: true, shortCode: true } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Link not found");
    if (existing.userId !== user.id) throw new AppError(403, "FORBIDDEN", "You do not own this link");
    await tx.link.delete({ where: { id } });
    return existing;
  });

  await cache.invalidateAll({ linkCode: deleted.shortCode, userId: user.id });
  logger.info("Link deleted", { linkId: id, userId: user.id });
  res.status(204).send();
}
