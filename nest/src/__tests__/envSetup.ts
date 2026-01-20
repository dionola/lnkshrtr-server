process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres@localhost:5432/link_shortener_nest_test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = '';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.JWT_EXPIRES_IN = '7d';
process.env.BCRYPT_ROUNDS = '1';
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
