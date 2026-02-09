import secrets

import requests as http_requests
from fastapi import HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..lib.formatters import format_user
from ..lib.jwt import sign_token
from ..models import User
from ..schemas.auth import LoginBody, SignupBody

GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'


def _err(code: str, message: str, http_status: int):
    raise HTTPException(status_code=http_status, detail={'error': {'code': code, 'message': message}})


def google_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_CALLBACK_URL)


def signup(body: SignupBody, db: Session) -> dict:
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        _err('CONFLICT', 'Email is already taken', 409)
    if db.query(User).filter(User.username == body.username).first():
        _err('CONFLICT', 'Username is already taken', 409)
    user = User(username=body.username, email=email)
    user.set_password(body.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'user': format_user(user), 'accessToken': sign_token(user.id)}


def login(body: LoginBody, db: Session) -> dict:
    email = body.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.check_password(body.password):
        _err('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    return {'user': format_user(user), 'accessToken': sign_token(user.id)}


def me(current_user: User) -> dict:
    return format_user(current_user)


def google_init() -> RedirectResponse:
    if not google_configured():
        raise HTTPException(status_code=501,
                            detail={'error': {'code': 'NOT_IMPLEMENTED',
                                              'message': 'Google OAuth is not configured on this server'}})
    params = '&'.join([f'client_id={settings.GOOGLE_CLIENT_ID}',
                       f'redirect_uri={settings.GOOGLE_CALLBACK_URL}',
                       'response_type=code', 'scope=openid email profile',
                       f'state={secrets.token_urlsafe(16)}'])
    return RedirectResponse(url=f'{GOOGLE_AUTH_URL}?{params}')


def google_callback(code: str | None, db: Session) -> RedirectResponse:
    if not google_configured():
        raise HTTPException(status_code=501,
                            detail={'error': {'code': 'NOT_IMPLEMENTED',
                                              'message': 'Google OAuth is not configured on this server'}})
    if not code:
        _err('VALIDATION_ERROR', 'Missing authorization code', 400)
    token_resp = http_requests.post(GOOGLE_TOKEN_URL, data={
        'code': code, 'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_CALLBACK_URL, 'grant_type': 'authorization_code',
    })
    if not token_resp.ok:
        _err('INTERNAL_ERROR', 'Failed to exchange OAuth code', 500)
    userinfo_resp = http_requests.get(GOOGLE_USERINFO_URL,
                                      headers={'Authorization': f'Bearer {token_resp.json().get("access_token")}'})
    if not userinfo_resp.ok:
        _err('INTERNAL_ERROR', 'Failed to fetch user info from Google', 500)
    info = userinfo_resp.json()
    email = info.get('email', '').lower()
    name = info.get('name') or info.get('given_name') or email.split('@')[0]
    user = db.query(User).filter(User.email == email).first()
    if not user:
        base = name.replace(' ', '').lower()[:40] or 'user'
        username, suffix = base, 1
        while db.query(User).filter(User.username == username).first():
            username = f'{base}{suffix}'
            suffix += 1
        user = User(username=username, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return RedirectResponse(url=f'{settings.FRONTEND_URL}/auth/callback?token={sign_token(user.id)}')
