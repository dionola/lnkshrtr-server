from datetime import datetime, timedelta, timezone

import jwt

from ..config import settings


def sign_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'iat': datetime.now(tz=timezone.utc),
        'exp': datetime.now(tz=timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def verify_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
