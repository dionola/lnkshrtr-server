import secrets
import string

ALPHABET = string.ascii_letters + string.digits


def generate_short_code(length: int = 6) -> str:
    return ''.join(secrets.choice(ALPHABET) for _ in range(length))


def generate_unique_short_code(db_session, length: int = 6) -> str:
    from ..models import Link
    for _ in range(10):
        code = generate_short_code(length)
        if not db_session.query(Link).filter(Link.short_code == code).first():
            return code
    raise RuntimeError('Could not generate a unique short code after 10 attempts')
