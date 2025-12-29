import { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export async function errorHandler(
  err: unknown,
  _req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (err instanceof AppError) {
    reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError || hasZodFastifySchemaValidationErrors(err)) {
    const message = err instanceof ZodError
      ? (err.issues[0]?.message ?? "Validation failed")
      : ((err as { validation: Array<{ message: string }> }).validation[0]?.message ?? "Validation failed");
    reply.status(400).send({ error: { code: "VALIDATION_ERROR", message } });
    return;
  }

  logger.error("Unhandled error", {
    error: err instanceof Error ? err.message : String(err),
  });

  reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
}
