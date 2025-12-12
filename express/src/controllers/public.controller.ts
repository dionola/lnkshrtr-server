import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/redis";
import { AppError } from "../middleware/errorHandler";
import { routeParam } from "../lib/routeParam";
import { userResponseSchema } from "../schemas/auth.schemas";
import { linkResponseSchema, GetPublicLinksQuery } from "../schemas/links.schemas";

export async function getPublicUser(req: Request, res: Response): Promise<void> {
  const username = routeParam(req, "username");

  const cached = await cache.getPublicUser(username);
  if (cached) { res.json(cached); return; }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const response = userResponseSchema.parse(user);
  await cache.setPublicUser(username, response);
  res.json(response);
}

export async function getPublicLinks(req: Request, res: Response): Promise<void> {
  const username = routeParam(req, "username");
  const { type } = req.query as GetPublicLinksQuery;

  const cacheKey = type ? `${username}:${type}` : username;
  const cached = await cache.getPublicLinks(cacheKey);
  if (cached) { res.json(cached); return; }

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const links = await prisma.link.findMany({
    where: { userId: user.id, isPublic: true, isActive: true, ...(type && { type }) },
    orderBy: { createdAt: "desc" },
  });

  const response = links.map((l) => linkResponseSchema.parse(l));
  await cache.setPublicLinks(cacheKey, response);
  res.json(response);
}
