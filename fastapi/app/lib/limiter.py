from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.THROTTLE_LIMIT}/15 minutes"],
)
