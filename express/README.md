# lnkshrtr — Express

Express 5 + TypeScript + Prisma + PostgreSQL.

## Structure

```
src/
  config/       env validation, Passport setup
  controllers/  route handlers
  lib/          prisma client, jwt, redis, utilities
  middleware/   auth, error handling, validation
  routes/       routers by feature
  schemas/      zod input schemas
  __tests__/    integration tests
prisma/
  schema.prisma
```

## Environment

Copy `.env.example` to `.env`:

```
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:password@localhost:5432/linkshrtr
DIRECT_URL=postgresql://postgres:password@localhost:5432/linkshrtr
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

## Start

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

## Docker

```bash
docker compose up --build
```
