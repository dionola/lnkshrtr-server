import json
import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from .config import settings
from .lib import redis
from .lib.database import SessionLocal
from .lib.limiter import limiter
from .middleware.exceptions import global_exception_handler, http_exception_handler, validation_exception_handler
from .routers import auth, links, public

app = FastAPI(title='LinkShrtr API', version='1.0.0', docs_url=None, redoc_url=None, redirect_slashes=False)
app.state.limiter = limiter


class StripTrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path != '/' and request.url.path.endswith('/'):
            request.scope['path'] = request.url.path.rstrip('/')
        return await call_next(request)
app.add_middleware(StripTrailingSlashMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_URL],
                   allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(RateLimitExceeded, lambda request, exc: Response(
    content='{"error":{"code":"RATE_LIMITED","message":"Too many requests - please try again later"}}',
    status_code=429,
    media_type='application/json',
))
app.include_router(auth.router, prefix='/api')
app.include_router(links.router, prefix='/api')
app.include_router(public.router, prefix='/api')

_start_time = time.time()


@app.get('/health')
def health(): return {'status': 'ok'}


@app.get('/health/live')
def health_live(): return {'status': 'ok', 'uptime': time.time() - _start_time}


@app.get('/health/ready')
def health_ready():
    from datetime import datetime, timezone
    checks = {}
    try:
        with SessionLocal() as db:
            db.execute(text('SELECT 1'))
        checks['database'] = 'ok'
    except Exception:
        checks['database'] = 'error'

    if settings.REDIS_URL:
        checks['redis'] = 'ok' if redis.ping() else 'error'
    else:
        checks['redis'] = 'disabled'

    healthy = checks['database'] == 'ok' and checks['redis'] != 'error'
    return Response(
        content=json.dumps({
            'status': 'ok' if healthy else 'degraded',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'checks': checks,
        }),
        status_code=200 if healthy else 503,
        media_type='application/json',
    )
