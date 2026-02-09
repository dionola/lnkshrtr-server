import pytest
from tests.factories import create_user, create_user_with_token, make_expired_token, make_malformed_token


# ── POST /api/auth/signup ─────────────────────────────────────────────────────

class TestSignup:
    def test_returns_201_with_user_and_token(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'alice', 'email': 'alice@example.com', 'password': 'secret123',
        })
        assert res.status_code == 201
        assert 'user' in res.json()
        assert 'accessToken' in res.json()

    def test_user_has_correct_fields(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'bob', 'email': 'bob@example.com', 'password': 'secret123',
        })
        user = res.json()['user']
        assert user['username'] == 'bob'
        assert user['email'] == 'bob@example.com'
        assert 'id' in user
        assert 'createdAt' in user
        assert 'password' not in user

    def test_password_is_hashed_in_db(self, client, db):
        from app.models import User
        client.post('/api/auth/signup', json={
            'username': 'carol', 'email': 'carol@example.com', 'password': 'secret123',
        })
        user = db.query(User).filter(User.username == 'carol').first()
        assert user.password != 'secret123'
        assert user.password.startswith('$2b$')

    def test_409_duplicate_username(self, client, db):
        create_user(db, username='dave', email='dave@example.com')
        res = client.post('/api/auth/signup', json={
            'username': 'dave', 'email': 'other@example.com', 'password': 'secret123',
        })
        assert res.status_code == 409
        assert res.json()['error']['code'] == 'CONFLICT'

    def test_409_duplicate_email(self, client, db):
        create_user(db, username='eve', email='eve@example.com')
        res = client.post('/api/auth/signup', json={
            'username': 'eve2', 'email': 'eve@example.com', 'password': 'secret123',
        })
        assert res.status_code == 409
        assert res.json()['error']['code'] == 'CONFLICT'

    def test_400_username_too_short(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'ab', 'email': 'ab@example.com', 'password': 'secret123',
        })
        assert res.status_code == 400
        assert res.json()['error']['code'] == 'VALIDATION_ERROR'

    def test_400_password_too_short(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'frank', 'email': 'frank@example.com', 'password': 'abc',
        })
        assert res.status_code == 400
        assert res.json()['error']['code'] == 'VALIDATION_ERROR'

    def test_never_returns_password_field(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'nopwfield', 'email': 'nopwfield@example.com', 'password': 'secret123',
        })
        assert 'password' not in res.json()['user']

    def test_valid_jwt_sub_is_user_id(self, client):
        import jwt as pyjwt
        res = client.post('/api/auth/signup', json={
            'username': 'subjwt', 'email': 'subjwt@example.com', 'password': 'secret123',
        })
        token = res.json()['accessToken']
        decoded = pyjwt.decode(token, options={"verify_signature": False})
        assert decoded['sub'] == res.json()['user']['id']

    def test_400_invalid_email(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'bademail', 'email': 'not-an-email', 'password': 'secret123',
        })
        assert res.status_code == 400
        assert res.json()['error']['code'] == 'VALIDATION_ERROR'

    def test_400_missing_username(self, client):
        res = client.post('/api/auth/signup', json={
            'email': 'nouser@example.com', 'password': 'secret123',
        })
        assert res.status_code == 400

    def test_400_missing_password(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'nopw2', 'email': 'nopw2@example.com',
        })
        assert res.status_code == 400

    def test_400_missing_email(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'grace', 'password': 'secret123',
        })
        assert res.status_code == 400

    def test_400_empty_body(self, client):
        res = client.post('/api/auth/signup', json={})
        assert res.status_code == 400

    def test_400_body_not_json(self, client):
        res = client.post('/api/auth/signup',
                          headers={'Content-Type': 'text/plain'},
                          data='not json')
        assert res.status_code == 400

    def test_username_exactly_3_chars_accepted(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'abc', 'email': 'abc3@example.com', 'password': 'secret123',
        })
        assert res.status_code == 201

    def test_password_exactly_6_chars_accepted(self, client):
        res = client.post('/api/auth/signup', json={
            'username': 'pw6user', 'email': 'pw6user@example.com', 'password': 'abc123',
        })
        assert res.status_code == 201

    def test_access_token_is_valid_jwt(self, client):
        import jwt as pyjwt
        from app.config import settings
        res = client.post('/api/auth/signup', json={
            'username': 'ida', 'email': 'ida@example.com', 'password': 'secret123',
        })
        token = res.json()['accessToken']
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
        assert payload['sub'] == res.json()['user']['id']


# ── POST /api/auth/login ──────────────────────────────────────────────────────

class TestLogin:
    def test_returns_200_with_user_and_token(self, client, db):
        create_user(db, username='loginuser', email='login@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'login@example.com', 'password': 'mypassword',
        })
        assert res.status_code == 200
        assert 'user' in res.json()
        assert 'accessToken' in res.json()

    def test_returns_correct_user(self, client, db):
        create_user(db, username='loginuser2', email='login2@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'login2@example.com', 'password': 'mypassword',
        })
        assert res.json()['user']['email'] == 'login2@example.com'

    def test_401_wrong_password(self, client, db):
        create_user(db, username='wrongpw', email='wrongpw@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'wrongpw@example.com', 'password': 'wrongpassword',
        })
        assert res.status_code == 401
        assert res.json()['error']['code'] == 'INVALID_CREDENTIALS'

    def test_401_unknown_email(self, client):
        res = client.post('/api/auth/login', json={
            'email': 'nobody@example.com', 'password': 'mypassword',
        })
        assert res.status_code == 401
        assert res.json()['error']['code'] == 'INVALID_CREDENTIALS'

    def test_never_returns_password_field(self, client, db):
        create_user(db, username='loginpw', email='loginpw@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'loginpw@example.com', 'password': 'mypassword',
        })
        assert 'password' not in res.json()['user']

    def test_401_oauth_user_no_password(self, client, db):
        from app.models import User
        user = create_user(db, username='oauthuser', email='oauth@example.com', password=None)
        # Ensure hashed_password is None (OAuth user)
        user.password = None
        db.commit()
        res = client.post('/api/auth/login', json={
            'email': 'oauth@example.com', 'password': 'anypassword',
        })
        assert res.status_code == 401
        assert res.json()['error']['code'] == 'INVALID_CREDENTIALS'

    def test_400_email_missing(self, client):
        res = client.post('/api/auth/login', json={'password': 'mypassword'})
        assert res.status_code == 400

    def test_400_password_missing(self, client):
        res = client.post('/api/auth/login', json={'email': 'someone@example.com'})
        assert res.status_code == 400

    def test_400_invalid_email_format(self, client):
        res = client.post('/api/auth/login', json={'email': 'not-an-email', 'password': 'mypassword'})
        assert res.status_code == 400

    def test_400_empty_body(self, client):
        res = client.post('/api/auth/login', json={})
        assert res.status_code == 400

    def test_same_error_wrong_email_vs_wrong_password(self, client, db):
        create_user(db, username='sameErr', email='sameerr@example.com', password='mypassword')
        res_wrong_pw = client.post('/api/auth/login', json={
            'email': 'sameerr@example.com', 'password': 'wrongpassword',
        })
        res_wrong_email = client.post('/api/auth/login', json={
            'email': 'nobody_sameerr@example.com', 'password': 'mypassword',
        })
        assert res_wrong_pw.status_code == 401
        assert res_wrong_email.status_code == 401
        assert res_wrong_pw.json()['error']['message'] == res_wrong_email.json()['error']['message']

    def test_401_empty_password(self, client, db):
        create_user(db, username='emptypw', email='emptypw@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'emptypw@example.com', 'password': '',
        })
        assert res.status_code == 401

    def test_case_insensitive_email(self, client, db):
        create_user(db, username='casetest', email='case@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'CASE@EXAMPLE.COM', 'password': 'mypassword',
        })
        assert res.status_code == 200

    def test_token_has_correct_sub(self, client, db):
        import jwt as pyjwt
        from app.config import settings
        user = create_user(db, username='subtest', email='subtest@example.com', password='mypassword')
        res = client.post('/api/auth/login', json={
            'email': 'subtest@example.com', 'password': 'mypassword',
        })
        payload = pyjwt.decode(res.json()['accessToken'], settings.JWT_SECRET, algorithms=['HS256'])
        assert payload['sub'] == user.id


# ── GET /api/auth/me ──────────────────────────────────────────────────────────

class TestMe:
    def test_returns_authenticated_user(self, client, db):
        user, token = create_user_with_token(db, username='meuser', email='me@example.com')
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        assert res.json()['username'] == 'meuser'

    def test_does_not_return_password(self, client, db):
        _, token = create_user_with_token(db, username='menopw', email='menopw@example.com')
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        assert 'password' not in res.json()

    def test_401_no_token(self, client):
        res = client.get('/api/auth/me')
        assert res.status_code == 401
        assert res.json()['error']['code'] == 'UNAUTHORIZED'

    def test_401_malformed_token(self, client):
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {make_malformed_token()}'})
        assert res.status_code == 401

    def test_401_expired_token(self, client, db):
        user = create_user(db, username='expme', email='expme@example.com')
        token = make_expired_token(user.id)
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 401

    def test_401_wrong_scheme_basic(self, client, db):
        _, token = create_user_with_token(db, username='basicme', email='basicme@example.com')
        res = client.get('/api/auth/me', headers={'Authorization': f'Basic {token}'})
        assert res.status_code == 401

    def test_401_token_references_deleted_user(self, client):
        import uuid
        from app.config import settings
        import jwt as pyjwt
        fake_id = str(uuid.uuid4())
        token = pyjwt.encode({'sub': fake_id}, settings.JWT_SECRET, algorithm='HS256')
        res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 401


# ── GET /api/auth/google ──────────────────────────────────────────────────────

class TestGoogleOAuth:
    def test_returns_501_when_not_configured(self, client):
        res = client.get('/api/auth/google', follow_redirects=False)
        assert res.status_code == 501
        assert res.json()['error']['code'] == 'NOT_IMPLEMENTED'
