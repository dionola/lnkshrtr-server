import request from "supertest";

jest.mock("../lib/redis", () => ({
  cache: {
    getLinkByCode: jest.fn().mockResolvedValue(null),
    setLinkByCode: jest.fn().mockResolvedValue(undefined),
    invalidateLinkByCode: jest.fn().mockResolvedValue(undefined),
    getPublicUser: jest.fn().mockResolvedValue(null),
    setPublicUser: jest.fn().mockResolvedValue(undefined),
    invalidatePublicUser: jest.fn().mockResolvedValue(undefined),
    getPublicLinks: jest.fn().mockResolvedValue(null),
    setPublicLinks: jest.fn().mockResolvedValue(undefined),
    getUserLinks: jest.fn().mockResolvedValue(null),
    setUserLinks: jest.fn().mockResolvedValue(undefined),
    invalidateUserLinks: jest.fn().mockResolvedValue(undefined),
    invalidateAll: jest.fn().mockResolvedValue(undefined),
  },
  redisClient: null,
}));

import { getServer } from "./helpers/testApp";
import { prisma } from "../lib/prisma";
import {
  createUserWithToken,
  createLink,
  makeMalformedToken,
  makeExpiredToken,
} from "./helpers/factories";

// ─── GET /api/links ───────────────────────────────────────────────────────────

describe("GET /api/links", () => {
  it("returns an empty array when user has no links", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns all links belonging to the authenticated user", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    await createLink({ userId: user.id, shortCode: "aaa111" });
    await createLink({ userId: user.id, shortCode: "bbb222" });

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((l: { userId: string }) => l.userId === user.id)).toBe(true);
  });

  it("does not return links belonging to another user", async () => {
    const app = await getServer();
    const { user: user1, token: token1 } = await createUserWithToken();
    const { user: user2 } = await createUserWithToken();
    await createLink({ userId: user1.id, shortCode: "u1link1" });
    await createLink({ userId: user2.id, shortCode: "u2link1" });

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(user1.id);
  });

  it("never returns the password field on any link", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    await createLink({
      userId: user.id,
      shortCode: "pwlink1",
      isPasswordProtected: true,
      password: "secret99",
    });

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    res.body.forEach((link: Record<string, unknown>) => {
      expect(link.password).toBeUndefined();
    });
  });

  it("returns links ordered newest first", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const first = await createLink({ userId: user.id, shortCode: "old001" });
    await new Promise((r) => setTimeout(r, 10));
    const second = await createLink({ userId: user.id, shortCode: "new001" });

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body[0].id).toBe(second.id);
    expect(res.body[1].id).toBe(first.id);
  });

  it("returns 401 without Authorization header", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/links");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with malformed token", async () => {
    const app = await getServer();
    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${makeMalformedToken()}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 with an expired token", async () => {
    const app = await getServer();
    const { user } = await createUserWithToken();
    const expired = makeExpiredToken(user.id);

    const res = await request(app)
      .get("/api/links")
      .set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/links ──────────────────────────────────────────────────────────

describe("POST /api/links", () => {
  it("creates a link with a valid URL and returns 201", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    expect(res.status).toBe(201);
    expect(res.body.originalUrl).toBe("https://example.com");
    expect(res.body.shortCode).toBeDefined();
    expect(res.body.shortCode).toHaveLength(6);
  });

  it("defaults isPublic=true, isPasswordProtected=false, type=link", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    expect(res.body.isPublic).toBe(true);
    expect(res.body.isPasswordProtected).toBe(false);
    expect(res.body.type).toBe("link");
    expect(res.body.visits).toBe(0);
    expect(res.body.isActive).toBe(true);
  });

  it("sets title to the hostname of the URL", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://github.com/user/repo" });

    expect(res.body.title).toBe("github.com");
  });

  it("uses a custom short code when provided", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", customCode: "mycode" });

    expect(res.status).toBe(201);
    expect(res.body.shortCode).toBe("mycode");
  });

  it("returns 409 when custom code is already taken", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    await createLink({ userId: user.id, shortCode: "taken1" });

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", customCode: "taken1" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("creates a private link when isPublic=false", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", isPublic: false });

    expect(res.status).toBe(201);
    expect(res.body.isPublic).toBe(false);
  });

  it("creates a password-protected link with valid password", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({
        url: "https://example.com",
        isPasswordProtected: true,
        password: "secret99",
      });

    expect(res.status).toBe(201);
    expect(res.body.isPasswordProtected).toBe(true);
    expect(res.body.password).toBeUndefined();
  });

  it("returns 400 when isPasswordProtected=true but no password provided", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", isPasswordProtected: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when isPasswordProtected=true but password is too short", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({
        url: "https://example.com",
        isPasswordProtected: true,
        password: "abc",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for ftp:// URL", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "ftp://files.example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for data: URL", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "data:text/html,<h1>hello</h1>" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for javascript: URL", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a plain string that is not a URL", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "not-a-url-at-all" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when url is missing", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublic: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("http:// URLs are accepted (not just https)", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "http://example.com" });

    expect(res.status).toBe(201);
    expect(res.body.originalUrl).toBe("http://example.com");
  });

  it("never returns password in response even for protected links", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({
        url: "https://example.com",
        isPasswordProtected: true,
        password: "secretpassword",
      });

    expect(res.body.password).toBeUndefined();
  });

  it("allows unauthenticated creation of public links", async () => {
    const app = await getServer();
    const res = await request(app)
      .post("/api/links")
      .send({ url: "https://example.com" });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeNull();
  });

  it("assigns the link to the authenticated user", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();

    const res = await request(app)
      .post("/api/links")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com" });

    expect(res.body.userId).toBe(user.id);
  });
});

// ─── PUT /api/links/:id ───────────────────────────────────────────────────────

describe("PUT /api/links/:id", () => {
  it("updates link title", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd001" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New Title");
  });

  it("updates isPublic to false", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd002", isPublic: true });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublic: false });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(false);
  });

  it("deactivates a link with isActive=false", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd003" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("enables password protection with a valid password", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd004" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPasswordProtected: true, password: "newpassword" });

    expect(res.status).toBe(200);
    expect(res.body.isPasswordProtected).toBe(true);
    expect(res.body.password).toBeUndefined();
  });

  it("disabling password protection clears the stored password", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({
      userId: user.id,
      shortCode: "upd005",
      isPasswordProtected: true,
      password: "oldpass1",
    });

    await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPasswordProtected: false });

    const dbLink = await prisma.link.findUnique({ where: { id: link.id } });
    expect(dbLink!.password).toBeNull();
    expect(dbLink!.isPasswordProtected).toBe(false);
  });

  it("returns 400 when enabling password protection with short password", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd006" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPasswordProtected: true, password: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for a non-existent link id", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put("/api/links/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ghost" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when trying to update another user's link", async () => {
    const app = await getServer();
    const { user: owner } = await createUserWithToken();
    const { token: attackerToken } = await createUserWithToken();
    const link = await createLink({ userId: owner.id, shortCode: "upd007" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ title: "Hijacked" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without auth", async () => {
    const app = await getServer();
    const { user } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd008" });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .send({ title: "No Auth" });

    expect(res.status).toBe(401);
  });

  it("partial update — untouched fields remain unchanged", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({
      userId: user.id,
      shortCode: "upd009",
      isPublic: false,
    });

    const res = await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Only Title Changed" });

    expect(res.body.title).toBe("Only Title Changed");
    expect(res.body.isPublic).toBe(false);
  });

  it("persists changes to the database", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "upd010" });

    await request(app)
      .put(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Persisted Title" });

    const dbLink = await prisma.link.findUnique({ where: { id: link.id } });
    expect(dbLink!.title).toBe("Persisted Title");
  });
});

// ─── DELETE /api/links/:id ────────────────────────────────────────────────────

describe("DELETE /api/links/:id", () => {
  it("deletes own link and returns 204", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "del001" });

    const res = await request(app)
      .delete(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);

    const dbLink = await prisma.link.findUnique({ where: { id: link.id } });
    expect(dbLink).toBeNull();
  });

  it("returns 404 for a non-existent link id", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .delete("/api/links/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when trying to delete another user's link", async () => {
    const app = await getServer();
    const { user: owner } = await createUserWithToken();
    const { token: attackerToken } = await createUserWithToken();
    const link = await createLink({ userId: owner.id, shortCode: "del002" });

    const res = await request(app)
      .delete(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    const dbLink = await prisma.link.findUnique({ where: { id: link.id } });
    expect(dbLink).not.toBeNull();
  });

  it("returns 401 without auth", async () => {
    const app = await getServer();
    const { user } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "del003" });

    const res = await request(app).delete(`/api/links/${link.id}`);

    expect(res.status).toBe(401);
  });

  it("link is removed from the database", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const link = await createLink({ userId: user.id, shortCode: "del004" });

    await request(app)
      .delete(`/api/links/${link.id}`)
      .set("Authorization", `Bearer ${token}`);

    const dbLink = await prisma.link.findUnique({ where: { id: link.id } });
    expect(dbLink).toBeNull();
  });

  it("other users' links are not affected", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken();
    const { user: other } = await createUserWithToken();
    const ownLink = await createLink({ userId: user.id, shortCode: "del005" });
    const otherLink = await createLink({ userId: other.id, shortCode: "del006" });

    await request(app)
      .delete(`/api/links/${ownLink.id}`)
      .set("Authorization", `Bearer ${token}`);

    const dbOther = await prisma.link.findUnique({ where: { id: otherLink.id } });
    expect(dbOther).not.toBeNull();
  });
});

// ─── GET /api/links/code/:shortCode ──────────────────────────────────────────

describe("GET /api/links/code/:shortCode", () => {
  it("returns link by short code without auth", async () => {
    const app = await getServer();
    await createLink({ shortCode: "pub001", originalUrl: "https://example.com" });

    const res = await request(app).get("/api/links/code/pub001");

    expect(res.status).toBe(200);
    expect(res.body.shortCode).toBe("pub001");
    expect(res.body.originalUrl).toBe("https://example.com");
  });

  it("never returns the password field", async () => {
    const app = await getServer();
    await createLink({
      shortCode: "pub002",
      isPasswordProtected: true,
      password: "secret99",
    });

    const res = await request(app).get("/api/links/code/pub002");

    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
  });

  it("returns the isPasswordProtected flag", async () => {
    const app = await getServer();
    await createLink({
      shortCode: "pub005",
      isPasswordProtected: true,
      password: "secret99",
    });

    const res = await request(app).get("/api/links/code/pub005");

    expect(res.status).toBe(200);
    expect(res.body.isPasswordProtected).toBe(true);
  });

  it("returns private links (frontend handles gating)", async () => {
    const app = await getServer();
    await createLink({ shortCode: "pub003", isPublic: false });

    const res = await request(app).get("/api/links/code/pub003");

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(false);
  });

  it("returns inactive links (frontend handles gating)", async () => {
    const app = await getServer();
    await createLink({ shortCode: "pub004", isActive: false });

    const res = await request(app).get("/api/links/code/pub004");

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("returns 404 for an unknown short code", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/links/code/unknown");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ─── POST /api/links/code/:shortCode/click ────────────────────────────────────

describe("POST /api/links/code/:shortCode/click", () => {
  it("returns 200 and increments visit count", async () => {
    const app = await getServer();
    await createLink({ shortCode: "clk001", visits: 5 });

    const res = await request(app).post("/api/links/code/clk001/click");

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));

    const dbLink = await prisma.link.findUnique({ where: { shortCode: "clk001" } });
    expect(dbLink!.visits).toBe(6);
  });

  it("returns 200 even for a non-existent short code (silent fail)", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/links/code/nonexistent/click");

    expect(res.status).toBe(200);
  });

  it("does not require authentication", async () => {
    const app = await getServer();
    await createLink({ shortCode: "clk002" });

    const res = await request(app).post("/api/links/code/clk002/click");

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/links/code/:shortCode (verify password) ───────────────────────

describe("POST /api/links/code/:shortCode (verify password)", () => {
  it("returns true for the correct password", async () => {
    const app = await getServer();
    await createLink({
      shortCode: "pw001",
      isPasswordProtected: true,
      password: "correctpass",
    });

    const res = await request(app)
      .post("/api/links/code/pw001")
      .send({ password: "correctpass" });

    expect(res.status).toBe(200);
    expect(res.body).toBe(true);
  });

  it("returns false for the wrong password", async () => {
    const app = await getServer();
    await createLink({
      shortCode: "pw002",
      isPasswordProtected: true,
      password: "correctpass",
    });

    const res = await request(app)
      .post("/api/links/code/pw002")
      .send({ password: "wrongpass" });

    expect(res.status).toBe(200);
    expect(res.body).toBe(false);
  });

  it("returns true for an unprotected link", async () => {
    const app = await getServer();
    await createLink({ shortCode: "pw003", isPasswordProtected: false });

    const res = await request(app)
      .post("/api/links/code/pw003")
      .send({ password: "anything" });

    expect(res.status).toBe(200);
    expect(res.body).toBe(true);
  });

  it("returns 404 for a non-existent short code", async () => {
    const app = await getServer();
    const res = await request(app)
      .post("/api/links/code/noexist")
      .send({ password: "anything" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when password field is missing", async () => {
    const app = await getServer();
    await createLink({ shortCode: "pw004", isPasswordProtected: true });

    const res = await request(app)
      .post("/api/links/code/pw004")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not require auth to verify password", async () => {
    const app = await getServer();
    await createLink({
      shortCode: "pw005",
      isPasswordProtected: true,
      password: "correctpass",
    });

    const res = await request(app)
      .post("/api/links/code/pw005")
      .send({ password: "correctpass" });

    expect(res.status).toBe(200);
    expect(res.body).toBe(true);
  });
});
