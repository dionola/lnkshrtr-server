import uuid
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.lib.jwt import sign_token
from app.models import Link, User


def create_user(db: Session, username=None, email=None, password='password123') -> User:
    if username is None:
        username = f'user_{uuid.uuid4().hex[:8]}'
    if email is None:
        email = f'{username}@example.com'
    user = User(username=username, email=email)
    if password:
        user.set_password(password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_with_token(db: Session, username=None, email=None,
                            password='password123') -> tuple:
    user = create_user(db, username=username, email=email, password=password)
    return user, sign_token(user.id)


def create_link(db: Session, user=None, short_code=None, original_url='https://example.com',
                title='Example', is_public=True, is_active=True, is_password_protected=False,
                password=None, link_type='link') -> Link:
    if short_code is None:
        short_code = uuid.uuid4().hex[:6]
    link = Link(short_code=short_code, original_url=original_url, title=title,
                is_public=is_public, is_active=is_active,
                is_password_protected=is_password_protected,
                type=link_type,
                user_id=user.id if user else None)
    if is_password_protected and password:
        link.set_password(password)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def make_expired_token(user_id=None) -> str:
    if user_id is None:
        user_id = str(uuid.uuid4())
    payload = {
        'sub': user_id,
        'iat': datetime.now(tz=timezone.utc) - timedelta(days=8),
        'exp': datetime.now(tz=timezone.utc) - timedelta(days=1),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def make_malformed_token() -> str:
    return 'not.a.valid.jwt.token'
