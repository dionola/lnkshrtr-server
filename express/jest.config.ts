import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  globalSetup: "<rootDir>/src/__tests__/globalSetup.ts",
  // Set env vars before any module is imported
  setupFiles: ["<rootDir>/src/__tests__/envSetup.ts"],
  // Run DB cleanup hooks (beforeEach/afterAll) after the test framework loads
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/dbSetup.ts"],
  testTimeout: 15000,
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/server.ts",
    "!src/__tests__/**",
    "!src/types/**",
  ],
  coverageReporters: ["text", "lcov"],
};

export default config;
