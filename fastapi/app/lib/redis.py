import json

import redis as _redis

from ..config import settings

_client: _redis.Redis | None = None
_initialized = False

_TTL = {'LINK_BY_CODE': 60, 'PUBLIC_USER': 120, 'PUBLIC_LINKS': 60, 'USER_LINKS': 30}


def _get_client() -> _redis.Redis | None:
    global _client, _initialized
    if _initialized:
        return _client
    _initialized = True
    if not settings.REDIS_URL:
        return None
    try:
        _client = _redis.from_url(settings.REDIS_URL, decode_responses=True,
                                   socket_connect_timeout=2, socket_timeout=2)
    except Exception:
        pass
    return _client


def _get(key: str):
    r = _get_client()
    if not r:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def _set(key: str, value, ttl: int) -> None:
    r = _get_client()
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


def _del(*keys: str) -> None:
    r = _get_client()
    if not r or not keys:
        return
    try:
        r.delete(*keys)
    except Exception:
        pass


def get_link_by_code(code): return _get(f'link:code:{code}')
def set_link_by_code(code, val): _set(f'link:code:{code}', val, _TTL['LINK_BY_CODE'])
def invalidate_link_by_code(code): _del(f'link:code:{code}')

def get_public_user(username): return _get(f'public:user:{username}')
def set_public_user(username, val): _set(f'public:user:{username}', val, _TTL['PUBLIC_USER'])

def get_public_links(username): return _get(f'public:links:{username}')
def set_public_links(username, val): _set(f'public:links:{username}', val, _TTL['PUBLIC_LINKS'])

def get_user_links(user_id): return _get(f'user:links:{user_id}')
def set_user_links(user_id, val): _set(f'user:links:{user_id}', val, _TTL['USER_LINKS'])
def invalidate_user_links(user_id): _del(f'user:links:{user_id}')

def invalidate_all(*, link_code=None, user_id=None):
    keys = []
    if link_code:
        keys.append(f'link:code:{link_code}')
    if user_id:
        keys.append(f'user:links:{user_id}')
    if keys:
        _del(*keys)

def ping() -> bool:
    r = _get_client()
    if not r:
        return False
    try:
        return bool(r.ping())
    except Exception:
        return False
