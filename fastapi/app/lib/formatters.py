from urllib.parse import urlparse


def extract_title(url: str) -> str:
    try:
        return urlparse(url).netloc or url[:50]
    except Exception:
        return url[:50]


def format_link(link) -> dict:
    return {
        'id': link.id,
        'shortCode': link.short_code,
        'originalUrl': link.original_url,
        'title': link.title,
        'visits': link.visits,
        'createdAt': link.created_at.isoformat() if link.created_at else None,
        'isPublic': link.is_public,
        'isActive': link.is_active,
        'isPasswordProtected': link.is_password_protected,
        'type': link.type,
        'userId': link.user_id,
        'updatedAt': link.updated_at.isoformat() if link.updated_at else None,
    }


def format_user(user) -> dict:
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'createdAt': user.created_at.isoformat() if user.created_at else None,
    }
