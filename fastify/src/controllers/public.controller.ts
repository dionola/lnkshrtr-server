import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/redis";
import { AppError } from "../middleware/errorHandler";
import { userResponseSchema } from "../schemas/auth.schemas";
import { linkResponseSchema, GetPublicLinksQuery } from "../schemas/links.schemas";

export async function getPublicUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username } = req.params as { username: string };

  const cached = await cache.getPublicUser(username);
  if (cached) { reply.send(cached); return; }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const response = userResponseSchema.parse(user);
  await cache.setPublicUser(username, response);
  reply.send(response);
}

export async function getPublicLinks(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username } = req.params as { username: string };
  const { type } = req.query as GetPublicLinksQuery;

  const cacheKey = type ? `${username}:${type}` : username;
  const cached = await cache.getPublicLinks(cacheKey);
  if (cached) { reply.send(cached); return; }

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const links = await prisma.link.findMany({
    where: { userId: user.id, isPublic: true, isActive: true, ...(type && { type }) },
    orderBy: { createdAt: "desc" },
  });

  const response = links.map((l) => linkResponseSchema.parse(l));
  await cache.setPublicLinks(cacheKey, response);
  reply.send(response);
}
