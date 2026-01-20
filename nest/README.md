# lnkshrtr — NestJS

NestJS 11 + TypeScript + Prisma + PostgreSQL.

## Structure

```
src/
  auth/         auth module, controller, jwt strategy
  common/       guards, filters, pipes, shared module
  config/       env validation
  database/     prisma service, redis service
  dto/          request/response contracts
  health/       health check module
  lib/          jwt helpers, short code generator
  links/        links module and controller
  public/       public profile module and controller
  schemas/      zod input schemas
  __tests__/    integration tests
prisma/
  schema.prisma
```

## Environment

Copy `.env.example` to `.env`:

```
NODE_ENV=development
PORT=3003
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:password@localhost:5432/linkshrtr
DIRECT_URL=postgresql://postgres:password@localhost:5432/linkshrtr
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3003/api/auth/google/callback
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
