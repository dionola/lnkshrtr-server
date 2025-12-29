import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { getPublicLinksQuerySchema, linkResponseSchema } from "../schemas/links.schemas";
import { userResponseSchema } from "../schemas/auth.schemas";
import { getPublicUser, getPublicLinks } from "../controllers/public.controller";
import { z } from "zod";

export async function publicRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get("/:username", {
    schema: { response: { 200: userResponseSchema } },
  }, getPublicUser);

  app.get("/:username/links", {
    schema: { querystring: getPublicLinksQuerySchema, response: { 200: z.array(linkResponseSchema) } },
  }, getPublicLinks);
}
