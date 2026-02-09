from tests.factories import create_link, create_user, create_user_with_token


class TestPublicProfile:
    def test_returns_public_profile(self, client, db):
        create_user(db, username='pubuser', email='pub@example.com')
        res = client.get('/api/public/pubuser')
        assert res.status_code == 200
        assert res.json()['username'] == 'pubuser'

    def test_includes_expected_fields(self, client, db):
        create_user(db, username='fieldtest', email='fieldtest@example.com')
        res = client.get('/api/public/fieldtest')
        data = res.json()
        assert 'id' in data
        assert 'username' in data
        assert 'email' in data
        assert 'createdAt' in data

    def test_does_not_include_password(self, client, db):
        create_user(db, username='nopwpub', email='nopwpub@example.com', password='secret')
        res = client.get('/api/public/nopwpub')
        assert 'password' not in res.json()

    def test_404_unknown_username(self, client):
        res = client.get('/api/public/nobody999')
        assert res.status_code == 404
        assert res.json()['error']['code'] == 'NOT_FOUND'

    def test_no_auth_required(self, client, db):
        create_user(db, username='noauth_pub', email='noauth_pub@example.com')
        res = client.get('/api/public/noauth_pub')
        assert res.status_code == 200


class TestPublicLinks:
    def test_returns_public_active_links(self, client, db):
        user = create_user(db, username='publinks', email='publinks@example.com')
        create_link(db, user=user, short_code='pl001', is_public=True, is_active=True)
        create_link(db, user=user, short_code='pl002', is_public=True, is_active=True)
        res = client.get('/api/public/publinks/links')
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_excludes_private_links(self, client, db):
        user = create_user(db, username='privlinks', email='privlinks@example.com')
        create_link(db, user=user, short_code='prv001', is_public=True, is_active=True)
        create_link(db, user=user, short_code='prv002', is_public=False, is_active=True)
        res = client.get('/api/public/privlinks/links')
        assert len(res.json()) == 1
        assert res.json()[0]['shortCode'] == 'prv001'

    def test_excludes_inactive_links(self, client, db):
        user = create_user(db, username='inactlinks', email='inactlinks@example.com')
        create_link(db, user=user, short_code='iact001', is_public=True, is_active=True)
        create_link(db, user=user, short_code='iact002', is_public=True, is_active=False)
        res = client.get('/api/public/inactlinks/links')
        assert len(res.json()) == 1
        assert res.json()[0]['shortCode'] == 'iact001'

    def test_excludes_both_private_and_inactive(self, client, db):
        user = create_user(db, username='mixed', email='mixed@example.com')
        create_link(db, user=user, short_code='mx001', is_public=True, is_active=True)
        create_link(db, user=user, short_code='mx002', is_public=False, is_active=False)
        create_link(db, user=user, short_code='mx003', is_public=True, is_active=False)
        create_link(db, user=user, short_code='mx004', is_public=False, is_active=True)
        res = client.get('/api/public/mixed/links')
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]['shortCode'] == 'mx001'

    def test_empty_list_when_no_public_links(self, client, db):
        create_user(db, username='nolnks', email='nolnks@example.com')
        res = client.get('/api/public/nolnks/links')
        assert res.status_code == 200
        assert res.json() == []

    def test_404_unknown_username(self, client):
        res = client.get('/api/public/nobody888/links')
        assert res.status_code == 404

    def test_no_auth_required(self, client, db):
        user = create_user(db, username='noauthlinks', email='noauthlinks@example.com')
        create_link(db, user=user, short_code='nal001')
        res = client.get('/api/public/noauthlinks/links')
        assert res.status_code == 200

    def test_links_do_not_expose_password_field(self, client, db):
        user = create_user(db, username='pwlinkspub', email='pwlinkspub@example.com')
        create_link(db, user=user, short_code='pwpub1', is_password_protected=True, password='secret')
        res = client.get('/api/public/pwlinkspub/links')
        assert 'password' not in res.json()[0]

    def test_excludes_other_users_links(self, client, db):
        user1 = create_user(db, username='pu1', email='pu1@example.com')
        user2 = create_user(db, username='pu2', email='pu2@example.com')
        create_link(db, user=user1, short_code='u1pub1')
        create_link(db, user=user2, short_code='u2pub1')
        res = client.get('/api/public/pu1/links')
        codes = [l['shortCode'] for l in res.json()]
        assert 'u1pub1' in codes
        assert 'u2pub1' not in codes
