import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from .lib.database import Base

def _uuid(): return str(uuid.uuid4())
def _now(): return datetime.now(tz=timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True, default=_uuid)
    username = Column(String(150), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(256), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    links = relationship('Link', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, raw):
        import bcrypt
        from .config import settings
        self.password = bcrypt.hashpw(raw.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode()

    def check_password(self, raw):
        if not self.password: return False
        import bcrypt
        return bcrypt.checkpw(raw.encode(), self.password.encode())

class Link(Base):
    __tablename__ = 'links'
    id = Column(String(36), primary_key=True, default=_uuid)
    short_code = Column(String(20), unique=True, nullable=False)
    original_url = Column(Text, nullable=False)
    title = Column(String(255), nullable=False)
    visits = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_password_protected = Column(Boolean, default=False, nullable=False)
    password = Column(String(256), nullable=True)
    type = Column(String(10), default='link', nullable=False)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    user = relationship('User', back_populates='links')
    __table_args__ = (Index('ix_links_user_id', 'user_id'),)

    def set_password(self, raw):
        import bcrypt
        from .config import settings
        self.password = bcrypt.hashpw(raw.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)).decode()

    def check_password(self, raw):
        if not self.password: return False
        import bcrypt
        return bcrypt.checkpw(raw.encode(), self.password.encode())
