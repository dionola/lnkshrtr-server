// Runs before any module imports — sets env vars for the test environment
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/link_shortener_express_test";
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? process.env.DATABASE_URL;
process.env.JWT_SECRET = "test-jwt-secret-32-chars-minimum!!";
process.env.REDIS_ENABLED = "false";
process.env.BCRYPT_ROUNDS = "1";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.PORT = "3001";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:3000/api/auth/google/callback";
