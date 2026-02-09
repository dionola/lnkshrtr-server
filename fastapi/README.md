# lnkshrtr — FastAPI

FastAPI + SQLAlchemy + Alembic + PostgreSQL.

## Structure

```
app/
  lib/          database, jwt, redis, logger, short code, rate limiter
  middleware/   auth, exception handling
  routers/      auth, links, public
  schemas/      pydantic request/response models
  services/     auth, links, public
  config.py     env config
  main.py       app setup
  models.py     sqlalchemy models
alembic/
  versions/     migration files
tests/
```

## Environment

Copy `.env.example` to `.env`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/linkshrtr
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
BCRYPT_ROUNDS=10
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback
```

## Start

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

## Docker

```bash
docker compose up --build
```
