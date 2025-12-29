import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

async function start(): Promise<void> {
  const fastify = await createApp();
  await fastify.ready();
  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`Server listening on port ${env.PORT}`);
}

start().catch((err) => {
  logger.error("Failed to start server", { error: (err as Error).message });
  process.exit(1);
});
