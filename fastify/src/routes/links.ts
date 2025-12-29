import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { requireAuth, optionalAuth } from "../middleware/auth";
import {
  createLinkSchema,
  updateLinkSchema,
  verifyPasswordSchema,
  getUserLinksQuerySchema,
  linkResponseSchema,
} from "../schemas/links.schemas";
import {
  getUserLinks,
  createLink,
  updateLink,
  deleteLink,
  getLinkByCode,
  verifyPassword,
  recordClick,
} from "../controllers/links.controller";
import { z } from "zod";

export async function linksRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get("/", {
    preHandler: [requireAuth],
    schema: { querystring: getUserLinksQuerySchema, response: { 200: z.array(linkResponseSchema) } },
  }, getUserLinks);

  app.post("/", {
    preHandler: [optionalAuth],
    schema: { body: createLinkSchema, response: { 201: linkResponseSchema } },
  }, createLink);

  app.put("/:id", {
    preHandler: [requireAuth],
    schema: { body: updateLinkSchema, response: { 200: linkResponseSchema } },
  }, updateLink);

  app.delete("/:id", {
    preHandler: [requireAuth],
  }, deleteLink);

  app.get("/code/:shortCode", {
    schema: { response: { 200: linkResponseSchema } },
  }, getLinkByCode);

  app.post("/code/:shortCode", {
    schema: { body: verifyPasswordSchema, response: { 200: z.boolean() } },
  }, verifyPassword);

  app.post("/code/:shortCode/click", recordClick);
}
