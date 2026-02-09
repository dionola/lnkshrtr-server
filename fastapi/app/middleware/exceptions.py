from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..lib.logger import logger


async def global_exception_handler(request: Request, exc: Exception):
    logger.error('Unhandled exception: %s', exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={'error': {'code': 'INTERNAL_ERROR', 'message': 'An unexpected error occurred'}},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)
    # HTTPBearer raises "Not authenticated" when no credentials provided
    if 'Not authenticated' in str(detail):
        return JSONResponse(
            status_code=401,
            content={'error': {'code': 'UNAUTHORIZED', 'message': 'Authentication required'}},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={'error': {'code': 'HTTP_ERROR', 'message': str(detail)}},
    )


def _serialize_errors(errors):
    result = []
    for e in errors:
        entry = {}
        for k, v in e.items():
            if k == 'ctx':
                entry['ctx'] = {ck: str(cv) for ck, cv in v.items()}
            elif isinstance(v, bytes):
                entry[k] = v.decode('utf-8', errors='replace')
            else:
                entry[k] = v
        result.append(entry)
    return result


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid input data',
                           'details': _serialize_errors(exc.errors())}},
    )
