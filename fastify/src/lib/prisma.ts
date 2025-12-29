import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

(prisma as PrismaClient).$on("error" as never, (e: { message: string }) => {
  logger.error("Prisma error", { message: e.message });
});

(prisma as PrismaClient).$on("warn" as never, (e: { message: string }) => {
  logger.warn("Prisma warning", { message: e.message });
});
