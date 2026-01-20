import { execSync } from "child_process";

export default async function globalSetup() {
  const testDatabaseUrl =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres@localhost:5432/link_shortener_nest_test";

  execSync("npx prisma db push", {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
    stdio: "pipe",
  });
}
