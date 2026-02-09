import pytest
from tests.factories import (
    create_link,
    create_user,
    create_user_with_token,
    make_expired_token,
    make_malformed_token,
)


# ── GET /api/links/code/{short_code} ─────────────────────────────────────────

class TestGetLinkByCode:
    def test_returns_link(self, client, db):
        create_link(db, short_code='abc123')
        res = client.get('/api/links/code/abc123')
        assert res.status_code == 200
        assert res.json()['shortCode'] == 'abc123'

    def test_404_unknown_code(self, client):
        res = client.get('/api/links/code/nope99')
        assert res.status_code == 404
        assert res.json()['error']['code'] == 'NOT_FOUND'

    def test_does_not_return_password_field(self, client, db):
        create_link(db, short_code='pw1234', is_password_protected=True, password='secret')
        res = client.get('/api/links/code/pw1234')
        assert 'password' not in res.json()

    def test_returns_password_protected_flag(self, client, db):
        create_link(db, short_code='pwflag', is_password_protected=True, password='secret')
        res = client.get('/api/links/code/pwflag')
        assert res.json()['isPasswordProtected'] is True

    def test_returns_private_links(self, client, db):
        create_link(db, short_code='privcode1', is_public=False)
        res = client.get('/api/links/code/privcode1')
        assert res.status_code == 200
        assert res.json()['shortCode'] == 'privcode1'

    def test_returns_inactive_links(self, client, db):
        create_link(db, short_code='inactcode1', is_active=False)
        res = client.get('/api/links/code/inactcode1')
        assert res.status_code == 200
        assert res.json()['shortCode'] == 'inactcode1'

# ── POST /api/links/code/{short_code}/click ───────────────────────────────────

class TestClickLink:
    def test_increments_visit_counter(self, client, db):
        from app.models import Link
        link = create_link(db, short_code='click1')
        assert link.visits == 0
        client.post('/api/links/code/click1/click')
        db.expire(link)
        db.refresh(link)
        assert link.visits == 1

    def test_multiple_clicks_accumulate(self, client, db):
        from app.models import Link
        link = create_link(db, short_code='click2')
        client.post('/api/links/code/click2/click')
        client.post('/api/links/code/click2/click')
        db.expire(link)
        db.refresh(link)
        assert link.visits == 2

    def test_200_for_unknown_code(self, client):
        res = client.post('/api/links/code/nocode99/click')
        assert res.status_code == 200


# ── POST /api/links/code/{short_code} — verify password ──────────────────────

class TestVerifyPassword:
    def test_true_for_correct_password(self, client, db):
        create_link(db, short_code='vp1', is_password_protected=True, password='correct')
        res = client.post('/api/links/code/vp1', json={'password': 'correct'})
        assert res.status_code == 200
        assert res.json() is True

    def test_false_for_wrong_password(self, client, db):
        create_link(db, short_code='vp2', is_password_protected=True, password='correct')
        res = client.post('/api/links/code/vp2', json={'password': 'wrong'})
        assert res.status_code == 200
        assert res.json() is False

    def test_true_for_unprotected_link(self, client, db):
        create_link(db, short_code='vp3', is_password_protected=False)
        res = client.post('/api/links/code/vp3', json={'password': 'anything'})
        assert res.status_code == 200
        assert res.json() is True

    def test_400_when_password_missing_for_protected_link(self, client, db):
        create_link(db, short_code='vp4', is_password_protected=True, password='secret')
        res = client.post('/api/links/code/vp4', json={})
        assert res.status_code == 400
        assert res.json()['error']['code'] == 'VALIDATION_ERROR'

    def test_404_unknown_code(self, client):
        res = client.post('/api/links/code/noop77', json={'password': 'x'})
        assert res.status_code == 404

    def test_no_auth_required(self, client, db):
        create_link(db, short_code='vp5', is_password_protected=True, password='mypassword')
        res = client.post('/api/links/code/vp5', json={'password': 'mypassword'})
        assert res.status_code == 200


# ── GET /api/links ─────────────────────────────────────────────────────────────

class TestListLinks:
    def test_returns_empty_array_when_no_links(self, client, db):
        _, token = create_user_with_token(db, username='emptylinks', email='emptylinks@example.com')
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_user_links(self, client, db):
        user, token = create_user_with_token(db, username='lister', email='lister@example.com')
        create_link(db, user=user, short_code='lst001')
        create_link(db, user=user, short_code='lst002')
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_excludes_other_users_links(self, client, db):
        user1, token1 = create_user_with_token(db, username='own1', email='own1@example.com')
        user2, _ = create_user_with_token(db, username='own2', email='own2@example.com')
        create_link(db, user=user1, short_code='u1l1')
        create_link(db, user=user2, short_code='u2l1')
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token1}'})
        codes = [l['shortCode'] for l in res.json()]
        assert 'u1l1' in codes
        assert 'u2l1' not in codes

    def test_never_returns_password_field(self, client, db):
        user, token = create_user_with_token(db, username='listpw', email='listpw@example.com')
        create_link(db, user=user, short_code='lstpw1', is_password_protected=True, password='secret')
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token}'})
        assert 'password' not in res.json()[0]

    def test_returns_links_ordered_newest_first(self, client, db):
        import time
        user, token = create_user_with_token(db, username='ordered', email='ordered@example.com')
        create_link(db, user=user, short_code='ord001')
        time.sleep(0.01)
        create_link(db, user=user, short_code='ord002')
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token}'})
        codes = [l['shortCode'] for l in res.json()]
        assert codes[0] == 'ord002'
        assert codes[1] == 'ord001'

    def test_401_without_auth(self, client):
        res = client.get('/api/links/')
        assert res.status_code == 401

    def test_401_malformed_token(self, client):
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {make_malformed_token()}'})
        assert res.status_code == 401

    def test_401_expired_token(self, client, db):
        user = create_user(db, username='explist', email='explist@example.com')
        token = make_expired_token(user.id)
        res = client.get('/api/links/', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 401


# ── POST /api/links ────────────────────────────────────────────────────────────

class TestCreateLink:
    def test_creates_link_201(self, client, db):
        _, token = create_user_with_token(db, username='creator', email='creator@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        assert 'shortCode' in res.json()

    def test_defaults_is_public_true_and_not_protected(self, client, db):
        _, token = create_user_with_token(db, username='defaults', email='defaults@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        data = res.json()
        assert data['isPublic'] is True
        assert data['isPasswordProtected'] is False
        assert data['type'] == 'link'

    def test_sets_title_to_hostname(self, client, db):
        _, token = create_user_with_token(db, username='titlehost', email='titlehost@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com/some/path'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        assert res.json()['title'] == 'example.com'

    def test_uses_custom_code(self, client, db):
        _, token = create_user_with_token(db, username='customc', email='customc@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com', 'customCode': 'mycode'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        assert res.json()['shortCode'] == 'mycode'

    def test_409_custom_code_taken(self, client, db):
        _, token = create_user_with_token(db, username='taken', email='taken@example.com')
        create_link(db, short_code='taken1')
        res = client.post('/api/links/', json={'url': 'https://example.com', 'customCode': 'taken1'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 409
        assert res.json()['error']['code'] == 'CONFLICT'

    def test_creates_private_link(self, client, db):
        _, token = create_user_with_token(db, username='privatelink', email='privatelink@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com', 'isPublic': False},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        assert res.json()['isPublic'] is False

    def test_400_ftp_url(self, client, db):
        _, token = create_user_with_token(db, username='ftpurl', email='ftpurl@example.com')
        res = client.post('/api/links/', json={'url': 'ftp://example.com'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_invalid_url_scheme(self, client, db):
        _, token = create_user_with_token(db, username='badurl', email='badurl@example.com')
        res = client.post('/api/links/', json={'url': 'javascript:alert(1)'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_data_url(self, client, db):
        _, token = create_user_with_token(db, username='dataurl', email='dataurl@example.com')
        res = client.post('/api/links/', json={'url': 'data:text/html,<h1>test</h1>'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_plain_string_not_url(self, client, db):
        _, token = create_user_with_token(db, username='plainstr', email='plainstr@example.com')
        res = client.post('/api/links/', json={'url': 'not a url at all'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_missing_url(self, client, db):
        _, token = create_user_with_token(db, username='nourl', email='nourl@example.com')
        res = client.post('/api/links/', json={},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_password_protected_without_password(self, client, db):
        _, token = create_user_with_token(db, username='nopw', email='nopw@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com', 'isPasswordProtected': True},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_400_password_too_short(self, client, db):
        _, token = create_user_with_token(db, username='shortpw', email='shortpw@example.com')
        res = client.post('/api/links/',
                          json={'url': 'https://example.com', 'isPasswordProtected': True, 'password': 'abc'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_creates_password_protected_link(self, client, db):
        _, token = create_user_with_token(db, username='withpw', email='withpw@example.com')
        res = client.post('/api/links/',
                          json={'url': 'https://example.com', 'isPasswordProtected': True, 'password': 'strongpassword'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201
        assert res.json()['isPasswordProtected'] is True

    def test_password_not_in_response(self, client, db):
        _, token = create_user_with_token(db, username='nopwresp', email='nopwresp@example.com')
        res = client.post('/api/links/',
                          json={'url': 'https://example.com', 'isPasswordProtected': True, 'password': 'strongpassword'},
                          headers={'Authorization': f'Bearer {token}'})
        assert 'password' not in res.json()

    def test_allows_unauthenticated_creation_of_public_links(self, client):
        res = client.post('/api/links/', json={'url': 'https://example.com'})
        assert res.status_code == 201
        assert res.json()['userId'] is None

    def test_http_url_accepted(self, client, db):
        _, token = create_user_with_token(db, username='httpurl', email='httpurl@example.com')
        res = client.post('/api/links/', json={'url': 'http://example.com'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 201

    def test_link_belongs_to_user(self, client, db):
        user, token = create_user_with_token(db, username='ownercheck', email='ownercheck@example.com')
        res = client.post('/api/links/', json={'url': 'https://example.com'},
                          headers={'Authorization': f'Bearer {token}'})
        assert res.json()['userId'] == user.id


# ── PUT /api/links/{id} ────────────────────────────────────────────────────────

class TestUpdateLink:
    def test_updates_title(self, client, db):
        user, token = create_user_with_token(db, username='updater', email='updater@example.com')
        link = create_link(db, user=user, short_code='upd001')
        res = client.put(f'/api/links/{link.id}', json={'title': 'New Title'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        assert res.json()['title'] == 'New Title'

    def test_updates_is_public(self, client, db):
        user, token = create_user_with_token(db, username='updpub', email='updpub@example.com')
        link = create_link(db, user=user, short_code='upd002')
        res = client.put(f'/api/links/{link.id}', json={'isPublic': False},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.json()['isPublic'] is False

    def test_updates_is_active(self, client, db):
        user, token = create_user_with_token(db, username='updact', email='updact@example.com')
        link = create_link(db, user=user, short_code='upd003')
        res = client.put(f'/api/links/{link.id}', json={'isActive': False},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.json()['isActive'] is False

    def test_can_add_password_protection(self, client, db):
        user, token = create_user_with_token(db, username='addpw', email='addpw@example.com')
        link = create_link(db, user=user, short_code='upd004')
        res = client.put(f'/api/links/{link.id}',
                         json={'isPasswordProtected': True, 'password': 'newpassword'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.json()['isPasswordProtected'] is True

    def test_clearing_password_protection_nulls_hash(self, client, db):
        from app.models import Link
        user, token = create_user_with_token(db, username='clrpw', email='clrpw@example.com')
        link = create_link(db, user=user, short_code='upd005', is_password_protected=True, password='old')
        client.put(f'/api/links/{link.id}', json={'isPasswordProtected': False},
                   headers={'Authorization': f'Bearer {token}'})
        db.expire(link)
        db.refresh(link)
        assert link.password is None

    def test_400_new_password_too_short(self, client, db):
        user, token = create_user_with_token(db, username='shortpw2', email='shortpw2@example.com')
        link = create_link(db, user=user, short_code='upd006')
        res = client.put(f'/api/links/{link.id}',
                         json={'isPasswordProtected': True, 'password': 'ab'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 400

    def test_404_nonexistent_link(self, client, db):
        import uuid
        _, token = create_user_with_token(db, username='notfound', email='notfound@example.com')
        res = client.put(f'/api/links/{uuid.uuid4()}', json={'title': 'X'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 404

    def test_403_another_users_link(self, client, db):
        user2 = create_user(db, username='other_upd', email='otherupd@example.com')
        other_link = create_link(db, user=user2, short_code='otherupd1')
        _, token = create_user_with_token(db, username='attacker_upd', email='attacker_upd@example.com')
        res = client.put(f'/api/links/{other_link.id}', json={'title': 'Hacked'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 403
        assert res.json()['error']['code'] == 'FORBIDDEN'

    def test_401_without_auth(self, client, db):
        user = create_user(db, username='noauth_upd', email='noauth_upd@example.com')
        link = create_link(db, user=user, short_code='upd007')
        res = client.put(f'/api/links/{link.id}', json={'title': 'X'})
        assert res.status_code == 401

    def test_persists_changes_to_db(self, client, db):
        from app.models import Link
        user, token = create_user_with_token(db, username='persist_upd', email='persist_upd@example.com')
        link = create_link(db, user=user, short_code='upd008')
        client.put(f'/api/links/{link.id}', json={'title': 'Persisted'},
                   headers={'Authorization': f'Bearer {token}'})
        db.expire(link)
        db.refresh(link)
        assert link.title == 'Persisted'

    def test_partial_update_untouched_fields_unchanged(self, client, db):
        user, token = create_user_with_token(db, username='partial_upd', email='partial_upd@example.com')
        link = create_link(db, user=user, short_code='upd009', is_public=True, is_active=True)
        res = client.put(f'/api/links/{link.id}', json={'title': 'Only Title Changed'},
                         headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        data = res.json()
        assert data['title'] == 'Only Title Changed'
        assert data['isPublic'] is True
        assert data['isActive'] is True


# ── DELETE /api/links/{id} ─────────────────────────────────────────────────────

class TestDeleteLink:
    def test_returns_204(self, client, db):
        user, token = create_user_with_token(db, username='deleter', email='deleter@example.com')
        link = create_link(db, user=user, short_code='del001')
        res = client.delete(f'/api/links/{link.id}', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 204

    def test_removes_from_db(self, client, db):
        from app.models import Link
        user, token = create_user_with_token(db, username='deleter2', email='deleter2@example.com')
        link = create_link(db, user=user, short_code='del002')
        link_id = link.id
        client.delete(f'/api/links/{link.id}', headers={'Authorization': f'Bearer {token}'})
        assert db.get(Link, link_id) is None

    def test_404_nonexistent_link(self, client, db):
        import uuid
        _, token = create_user_with_token(db, username='del404', email='del404@example.com')
        res = client.delete(f'/api/links/{uuid.uuid4()}', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 404

    def test_403_another_users_link(self, client, db):
        user2 = create_user(db, username='other_del', email='otherdel@example.com')
        other_link = create_link(db, user=user2, short_code='otherdel1')
        _, token = create_user_with_token(db, username='attacker_del', email='attacker_del@example.com')
        res = client.delete(f'/api/links/{other_link.id}', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 403

    def test_401_without_auth(self, client, db):
        user = create_user(db, username='noauth_del', email='noauth_del@example.com')
        link = create_link(db, user=user, short_code='del003')
        res = client.delete(f'/api/links/{link.id}')
        assert res.status_code == 401

    def test_other_links_unaffected(self, client, db):
        from app.models import Link
        user, token = create_user_with_token(db, username='safe_del', email='safe_del@example.com')
        link1 = create_link(db, user=user, short_code='del004')
        link2 = create_link(db, user=user, short_code='del005')
        client.delete(f'/api/links/{link1.id}', headers={'Authorization': f'Bearer {token}'})
        assert db.get(Link, link2.id) is not None
