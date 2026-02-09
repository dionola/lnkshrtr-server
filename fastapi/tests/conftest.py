import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.lib.database import Base, get_db
from app.main import app

settings.BCRYPT_ROUNDS = 4
settings.GOOGLE_CLIENT_ID = ''
settings.GOOGLE_CLIENT_SECRET = ''
settings.GOOGLE_CALLBACK_URL = ''

import os
TEST_DATABASE_URL = os.environ.get('TEST_DATABASE_URL', 'postgresql://postgres@localhost:5432/link_shortener_fastapi_test')

_test_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=_test_engine, autocommit=False, autoflush=False)

Base.metadata.create_all(bind=_test_engine, checkfirst=True)


@pytest.fixture(autouse=True)
def clean_db():
    yield
    with _test_engine.begin() as conn:
        conn.execute(text('DELETE FROM links'))
        conn.execute(text('DELETE FROM users'))


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()
