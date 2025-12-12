# LinkShrtr Backend

Four backend implementations of a link shortener API, each solving the same problem with a different framework. All implementations are functionally identical: same endpoints, same auth design, same data model, same Docker setup.

## Implementations

| Directory | Framework | Language |
|---|---|---|
| `express/` | Express 5 | TypeScript |
| `fastify/` | Fastify 5 | TypeScript |
| `nest/` | NestJS 11 | TypeScript |
| `fastapi/` | FastAPI | Python |

Each implementation provides:

- URL shortening with custom short codes
- User authentication — JWT + Google OAuth
- Rate limiting
- Redis caching (optional, gracefully disabled)
- Comprehensive integration test suite
- Docker Compose setup

See each directory's `README.md` for setup instructions and `TECHNICAL.md` for implementation details.

---

## Feature comparison

### Security headers

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Package | `helmet` (npm) | `@fastify/helmet` (npm) | `helmet` (npm, applied via `app.use()`) | No built-in — `starlette.middleware` or third-party |
| Source | third-party | official Fastify plugin | third-party | third-party / manual |

### CORS

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Package | `cors` (npm) | `@fastify/cors` (npm) | `app.enableCors()` built into NestJS | `CORSMiddleware` built into Starlette |
| Source | third-party | official Fastify plugin | built-in | built-in (via Starlette) |

### Rate limiting

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Package | `express-rate-limit` (npm) | `@fastify/rate-limit` (npm) | `@nestjs/throttler` (npm) | `slowapi` (PyPI) |
| Source | third-party | official Fastify plugin | official NestJS package | third-party |
| State | in-process | in-process | in-process | in-process |
| Redis adapter | available | available | `ThrottlerStorageRedisService` | available |

### Body parsing / JSON

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| How | `express.json()` middleware | built into Fastify core | built into NestJS | built into FastAPI via Pydantic |
| Source | built-in | built-in | built-in | built-in |

### Compression

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Package | `compression` (npm) | `@fastify/compress` (npm) | `compression` (npm, applied via `app.use()`) | `GZipMiddleware` from Starlette |
| Source | third-party | official Fastify plugin | third-party | built-in (via Starlette) |

### Request validation

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Library | Zod | Zod via `@fastify/type-provider-zod` | Zod (manual — project chose Zod over class-validator) | Pydantic (built-in) |
| Integration | manual `.parse()` in controllers | schema declared on route, validated automatically | manual `.parse()` in controllers | declared on route handler, validated automatically |
| Type inference | manual cast | automatic from schema | manual cast | automatic from model |

### Response serialization / field stripping

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| How | Zod `.parse()` before `res.json()` | schema declared on route, Fastify strips unlisted fields | Zod `.parse()` before response | Pydantic `response_model` strips unlisted fields |
| Automatic | no — must call manually | yes | no — must call manually | yes |

### Logging

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Library | `winston` (npm) | `pino` (built-in) | NestJS built-in Logger | no built-in request logger — must add middleware |
| Structured JSON | yes (configured) | yes (default) | yes | not by default |
| Per-request log | yes | yes (built-in) | yes | no (known issue) |

### Dependency injection

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| DI system | none — manual module imports | none — manual module imports / `fastify.decorate()` | full IoC container (`@Injectable()`, constructor injection) | `Depends()` function-parameter injection |
| Lifetime management | module singleton (Node cache) | module singleton | configurable (default: singleton) | per-request or singleton depending on `Depends()` usage |

### Auth middleware pattern

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Mechanism | custom middleware (`requireAuth`) | `preHandler` hook on routes | Guards (`@UseGuards(JwtGuard)`) | `Depends(get_current_user)` on handler signature |
| Optional auth | separate `optionalAuth` middleware | separate `preHandler` | separate guard | `Depends(security_optional)` with `auto_error=False` |

### Database ORM

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| ORM | Prisma | Prisma | Prisma (via `PrismaService` extending `PrismaClient`) | SQLAlchemy |
| Migration tool | Prisma Migrate | Prisma Migrate | Prisma Migrate | Alembic |
| Client lifecycle | module singleton via `globalThis` | module singleton via `globalThis` | `PrismaService` managed by NestJS DI | `SessionLocal` generator, closed in `finally` |

### Error handling

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Mechanism | global error middleware (4-arg) | `setErrorHandler()` | `@Catch()` exception filter, registered globally | `@app.exception_handler()` decorators |
| Async errors | automatic in Express 5 | automatic | automatic | automatic |

### Trailing slash handling

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| How | not needed — Express ignores by default | `ignoreTrailingSlash: true` on app creation | not needed — NestJS ignores by default | custom `StripTrailingSlashMiddleware` (no built-in option) |

### Testing

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Framework | Jest + `ts-jest` | Jest + `ts-jest` | Jest + `ts-jest` | pytest |
| HTTP client | `supertest` | `supertest` | `supertest` | `TestClient` (Starlette) |
| Database | real Postgres | real Postgres | real Postgres | real Postgres |
| Redis | mocked | mocked | mocked | mocked |
| Test isolation | `beforeEach` DELETE | `beforeEach` DELETE | `beforeEach` DELETE | `autouse` fixture DELETE |
| Parallelism | `--runInBand` (sequential) | `--runInBand` (sequential) | `--runInBand` (sequential) | default (sequential by default) |

### Cold start / bootstrap

| | Express | Fastify | NestJS | FastAPI |
|---|---|---|---|---|
| Approximate cold start | ~100ms | ~100ms | ~500ms–1s | ~200ms |
| Reason for overhead | — | — | DI container + decorator metadata processing | Pydantic model compilation |

---

## Data model

All implementations share the same schema:

```
User
  id           uuid
  email        unique
  username     unique
  password     bcrypt hash (null for OAuth-only users)
  googleId     nullable
  createdAt

Link
  id           uuid
  shortCode    unique, 6-char random alphanumeric
  originalUrl
  title        nullable
  description  nullable
  password     bcrypt hash (nullable, for password-protected links)
  isActive     bool
  expiresAt    nullable
  clickCount
  userId       FK → User (nullable, for anonymous links)
  createdAt
  updatedAt
```

## Auth design

JWT tokens are issued on login/signup. Every authenticated request reads `Authorization: Bearer <token>`, verifies it, and fetches the user from the DB (to ensure deleted users are rejected immediately). Google OAuth returns the same JWT structure as email/password login.

Redis is used to cache short code lookups. On a cache miss the DB is queried and the result is cached with a TTL.
