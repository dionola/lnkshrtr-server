from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..lib import redis
from ..lib.formatters import extract_title, format_link
from ..lib.short_code import generate_unique_short_code
from ..models import Link, User
from ..schemas.links import CreateLinkBody, UpdateLinkBody, VerifyPasswordBody


def _err(code: str, message: str, http_status: int):
    raise HTTPException(status_code=http_status, detail={'error': {'code': code, 'message': message}})


def get_by_code(short_code: str, db: Session) -> dict:
    cached = redis.get_link_by_code(short_code)
    if cached is not None:
        return cached
    link = db.query(Link).filter(Link.short_code == short_code).first()
    if not link:
        _err('NOT_FOUND', 'Short code not found', 404)
    result = format_link(link)
    redis.set_link_by_code(short_code, result)
    return result


def record_click(short_code: str, db: Session) -> dict:
    db.query(Link).filter(Link.short_code == short_code).update({Link.visits: Link.visits + 1})
    db.commit()
    redis.invalidate_link_by_code(short_code)
    return {}


def verify_password(short_code: str, body: VerifyPasswordBody, db: Session) -> bool:
    link = db.query(Link).filter(Link.short_code == short_code).first()
    if not link:
        _err('NOT_FOUND', 'Short code not found', 404)
    if not link.is_password_protected:
        return True
    if not link.password:
        return False
    return link.check_password(body.password)


def create_link(body: CreateLinkBody, db: Session, current_user: User | None) -> dict:
    custom_code = (body.customCode or '').strip()
    if custom_code:
        if db.query(Link).filter(Link.short_code == custom_code).first():
            _err('CONFLICT', 'Short code is already in use', 409)
        short_code = custom_code
    else:
        short_code = generate_unique_short_code(db)
    link = Link(short_code=short_code, original_url=body.url, title=extract_title(body.url),
                is_public=body.isPublic, is_active=True, is_password_protected=body.isPasswordProtected,
                type=body.type,
                user_id=current_user.id if current_user else None)
    if body.isPasswordProtected and body.password:
        link.set_password(body.password)
    db.add(link)
    db.commit()
    db.refresh(link)
    if link.user_id:
        redis.invalidate_user_links(link.user_id)
    return format_link(link)


def list_links(db: Session, current_user: User) -> list:
    cached = redis.get_user_links(current_user.id)
    if cached is not None:
        return cached
    links = db.query(Link).filter(Link.user_id == current_user.id).order_by(Link.created_at.desc()).all()
    result = [format_link(l) for l in links]
    redis.set_user_links(current_user.id, result)
    return result


def update_link(link_id: str, body: UpdateLinkBody, db: Session, current_user: User) -> dict:
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        _err('NOT_FOUND', 'Link not found', 404)
    if link.user_id != current_user.id:
        _err('FORBIDDEN', 'You do not own this link', 403)
    if body.title is not None:
        link.title = body.title
    if body.isPublic is not None:
        link.is_public = body.isPublic
    if body.isActive is not None:
        link.is_active = body.isActive
    if body.isPasswordProtected is not None:
        link.is_password_protected = body.isPasswordProtected
    if link.is_password_protected:
        if body.password:
            link.set_password(body.password)
    else:
        link.password = None
    db.commit()
    db.refresh(link)
    redis.invalidate_all(link_code=link.short_code, user_id=current_user.id)
    return format_link(link)


def delete_link(link_id: str, db: Session, current_user: User) -> None:
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        _err('NOT_FOUND', 'Link not found', 404)
    if link.user_id != current_user.id:
        _err('FORBIDDEN', 'You do not own this link', 403)
    short_code, user_id = link.short_code, link.user_id
    db.delete(link)
    db.commit()
    redis.invalidate_all(link_code=short_code, user_id=user_id)
