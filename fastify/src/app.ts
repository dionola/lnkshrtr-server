import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import compression from "@fastify/compress";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import { authRoutes } from "./routes/auth";
import { linksRoutes } from "./routes/links";
import { publicRoutes } from "./routes/public";
import { cache } from "./lib/redis";
import { prisma } from "./lib/prisma";

export async function createApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: "info" },
    trustProxy: true,
    ignoreTrailingSlash: true,
  });

  // Wire Zod as the validator and serializer for all routes using withTypeProvider
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await fastify.register(rateLimit, { global: true, max: parseInt(process.env.THROTTLE_LIMIT ?? "500", 10), timeWindow: "15 minutes" });
  await fastify.register(compression);

  // Register shared infrastructure plugins (fp() breaks encapsulation so decorations are visible everywhere)
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);

  fastify.addHook("onSend", async (_req, reply) => {
    if (reply.request.url.startsWith("/api")) {
      reply.header("Cache-Control", "no-store");
    }
  });

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.get("/health/live", async () => ({ status: "ok", uptime: process.uptime() }));
  fastify.get("/health/ready", async () => {
    const checks: Record<string, string> = {};
    try { await prisma.$queryRaw`SELECT 1`; checks.database = "ok"; } catch { checks.database = "error"; }
    checks.redis = (await cache.ping()) ? "ok" : "error";
    const healthy = Object.values(checks).every((s) => s === "ok");
    return { status: healthy ? "ok" : "degraded", timestamp: new Date().toISOString(), checks };
  });

  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(linksRoutes, { prefix: "/api/links" });
  await fastify.register(publicRoutes, { prefix: "/api/public" });

  if (env.NODE_ENV === "test") {
    fastify.delete("/api/test/reset", async (_req, reply) => {
      await prisma.link.deleteMany();
      await prisma.user.deleteMany();
      reply.status(204).send();
    });
  }

  return fastify;
}
