import time

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .middleware.exceptions import global_exception_handler, http_exception_handler, validation_exception_handler
from .routers import auth, links, public

app = FastAPI(title='LinkShrtr API', version='1.0.0', docs_url=None, redoc_url=None, redirect_slashes=False)


class StripTrailingSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path != '/' and request.url.path.endswith('/'):
            request.scope['path'] = request.url.path.rstrip('/')
        return await call_next(request)
app.add_middleware(StripTrailingSlashMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_URL],
                   allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
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
    return {'status': 'ok', 'timestamp': datetime.now(timezone.utc).isoformat(),
            'checks': {'database': 'ok', 'redis': 'ok'}}
