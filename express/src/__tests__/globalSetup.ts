import { execSync } from "child_process";

export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres@localhost:5432/link_shortener_express_test";

  // Sync the schema for the test database before any tests run.
  // `db push` is idempotent, which makes repeated local test runs less brittle
  // than `migrate deploy` against an already-initialized database.
  execSync("npx prisma db push", {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: process.env.DIRECT_URL ?? testDatabaseUrl,
    },
    stdio: "pipe",
  });
}
