import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..lib.database import get_db
from ..lib.jwt import verify_token
from ..models import User

security = HTTPBearer(auto_error=False)
security_required = HTTPBearer(auto_error=True)


def _unauthorized(code: str, message: str):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={'error': {'code': code, 'message': message}},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_required),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        _unauthorized('UNAUTHORIZED', 'Authentication required')
    try:
        payload = verify_token(credentials.credentials)
    except pyjwt.ExpiredSignatureError:
        _unauthorized('UNAUTHORIZED', 'Token has expired')
    except pyjwt.InvalidTokenError:
        _unauthorized('UNAUTHORIZED', 'Invalid token')
    user = db.query(User).filter(User.id == payload['sub']).first()
    if not user:
        _unauthorized('UNAUTHORIZED', 'User not found')
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    try:
        payload = verify_token(credentials.credentials)
        return db.query(User).filter(User.id == payload['sub']).first()
    except Exception:
        return None
