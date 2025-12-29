import { execSync } from "child_process";

export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres@localhost:5432/link_shortener_fastify_test";

  execSync("npx prisma db push", {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: process.env.DIRECT_URL ?? testDatabaseUrl,
    },
    stdio: "pipe",
  });
}
