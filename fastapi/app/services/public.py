from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..lib import redis
from ..lib.formatters import format_link, format_user
from ..models import Link, User


def _err(code: str, message: str, http_status: int):
    raise HTTPException(status_code=http_status, detail={'error': {'code': code, 'message': message}})


def public_profile(username: str, db: Session) -> dict:
    cached = redis.get_public_user(username)
    if cached is not None:
        return cached
    user = db.query(User).filter(User.username == username).first()
    if not user:
        _err('NOT_FOUND', 'User not found', 404)
    result = format_user(user)
    redis.set_public_user(username, result)
    return result


def public_links(username: str, db: Session) -> list:
    cached = redis.get_public_links(username)
    if cached is not None:
        return cached
    user = db.query(User).filter(User.username == username).first()
    if not user:
        _err('NOT_FOUND', 'User not found', 404)
    links = (db.query(Link)
             .filter(Link.user_id == user.id, Link.is_public == True, Link.is_active == True)
             .order_by(Link.created_at.desc()).all())
    result = [format_link(l) for l in links]
    redis.set_public_links(username, result)
    return result
