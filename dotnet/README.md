# lnkshrtr — ASP.NET Core

ASP.NET Core Web API + EF Core + PostgreSQL.

## Structure

```
src/
  lnkshrtr.Api/
    Controllers/       http controllers
    Infrastructure/    middleware and validation helpers
    Program.cs         service registration and middleware pipeline
  lnkshrtr.Application/
    Config/            app options
    Dtos/              request and response contracts
    Errors/            app exception types
    Services/          service interfaces
  lnkshrtr.Domain/
    Models/            entity models
  lnkshrtr.Infrastructure/
    Data/              ef core db context
    Migrations/        ef core migrations
    Services/          service implementations
tests/
  lnkshrtr.Api.Tests/ xunit integration tests
```

## Environment

Copy `.env.example` to `.env`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/lnkshrtr_aspnet
JWT_SECRET=dev-secret-at-least-32-characters-long
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
PORT=3006
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
THROTTLE_LIMIT=500
THROTTLE_WINDOW=15m
APPLY_MIGRATIONS=true
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3006/api/auth/google/callback
```

## Start

```bash
cp .env.example .env
dotnet run --project src/lnkshrtr.Api
```

## Docker

```bash
docker compose up --build
```
