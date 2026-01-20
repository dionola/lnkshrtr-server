/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  setupFiles: ['<rootDir>/src/__tests__/envSetup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/dbSetup.ts'],
  testTimeout: 30000,
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
};
