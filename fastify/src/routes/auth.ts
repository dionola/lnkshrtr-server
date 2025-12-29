import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "@fastify/type-provider-zod";
import { requireAuth } from "../middleware/auth";
import { loginSchema, signupSchema, authResponseSchema, userResponseSchema } from "../schemas/auth.schemas";
import { login, signup, me, googleNotConfigured, googleCallback } from "../controllers/auth.controller";

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post("/signup", {
    schema: { body: signupSchema, response: { 201: authResponseSchema } },
  }, signup);

  app.post("/login", {
    schema: { body: loginSchema, response: { 200: authResponseSchema } },
  }, login);

  app.get("/me", {
    preHandler: [requireAuth],
    schema: { response: { 200: userResponseSchema } },
  }, me);

  app.get("/google", googleNotConfigured);
  app.get("/google/callback", googleCallback);
}
