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
import { createUser, createLink } from "./helpers/factories";

// ─── GET /api/public/:username ────────────────────────────────────────────────

describe("GET /api/public/:username", () => {
  it("returns a public user profile", async () => {
    const app = await getServer();
    await createUser({ username: "publicuser", email: "pub@example.com" });

    const res = await request(app).get("/api/public/publicuser");

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("publicuser");
    expect(res.body.email).toBe("pub@example.com");
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it("includes all expected fields in the response", async () => {
    const app = await getServer();
    await createUser({ username: "fieldtest", email: "fieldtest@example.com" });

    const res = await request(app).get("/api/public/fieldtest");

    expect(res.body.id).toBeDefined();
    expect(res.body.username).toBeDefined();
    expect(res.body.email).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it("never returns a password field", async () => {
    const app = await getServer();
    await createUser({
      username: "pwuser",
      email: "pwuser@example.com",
      password: "secret",
    });

    const res = await request(app).get("/api/public/pwuser");

    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
  });

  it("returns 404 for an unknown username", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/public/nosuchuser");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("does not require authentication", async () => {
    const app = await getServer();
    await createUser({ username: "noauth", email: "noauth@example.com" });

    const res = await request(app).get("/api/public/noauth");

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/public/:username/links ─────────────────────────────────────────

describe("GET /api/public/:username/links", () => {
  it("returns public active links for a user", async () => {
    const app = await getServer();
    const user = await createUser({ username: "linkowner", email: "lo@example.com" });
    await createLink({ userId: user.id, shortCode: "pubL01", isPublic: true, isActive: true });
    await createLink({ userId: user.id, shortCode: "pubL02", isPublic: true, isActive: true });

    const res = await request(app).get("/api/public/linkowner/links");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("excludes private links", async () => {
    const app = await getServer();
    const user = await createUser({ username: "privowner", email: "priv@example.com" });
    await createLink({ userId: user.id, shortCode: "pubV01", isPublic: true, isActive: true });
    await createLink({ userId: user.id, shortCode: "pubV02", isPublic: false, isActive: true });

    const res = await request(app).get("/api/public/privowner/links");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shortCode).toBe("pubV01");
  });

  it("excludes inactive links", async () => {
    const app = await getServer();
    const user = await createUser({ username: "inactowner", email: "inact@example.com" });
    await createLink({ userId: user.id, shortCode: "pubI01", isPublic: true, isActive: true });
    await createLink({ userId: user.id, shortCode: "pubI02", isPublic: true, isActive: false });

    const res = await request(app).get("/api/public/inactowner/links");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shortCode).toBe("pubI01");
  });

  it("excludes both private and inactive links simultaneously", async () => {
    const app = await getServer();
    const user = await createUser({ username: "mixed", email: "mixed@example.com" });
    await createLink({ userId: user.id, shortCode: "mx001", isPublic: true, isActive: true });
    await createLink({ userId: user.id, shortCode: "mx002", isPublic: false, isActive: false });
    await createLink({ userId: user.id, shortCode: "mx003", isPublic: true, isActive: false });
    await createLink({ userId: user.id, shortCode: "mx004", isPublic: false, isActive: true });

    const res = await request(app).get("/api/public/mixed/links");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shortCode).toBe("mx001");
  });

  it("returns an empty array when user has no public active links", async () => {
    const app = await getServer();
    const user = await createUser({ username: "emptylinks", email: "empty@example.com" });
    await createLink({ userId: user.id, shortCode: "el001", isPublic: false });

    const res = await request(app).get("/api/public/emptylinks/links");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("never returns password fields in any link", async () => {
    const app = await getServer();
    const user = await createUser({ username: "pwlinks", email: "pwlinks@example.com" });
    await createLink({
      userId: user.id,
      shortCode: "pwL01",
      isPublic: true,
      isActive: true,
      isPasswordProtected: true,
      password: "hidden99",
    });

    const res = await request(app).get("/api/public/pwlinks/links");

    expect(res.status).toBe(200);
    expect(res.body[0].password).toBeUndefined();
  });

  it("returns 404 when the user does not exist", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/public/nosuchuser/links");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("does not return links belonging to a different user", async () => {
    const app = await getServer();
    const user1 = await createUser({ username: "user1pub", email: "u1pub@example.com" });
    const user2 = await createUser({ username: "user2pub", email: "u2pub@example.com" });
    await createLink({ userId: user1.id, shortCode: "u1L01" });
    await createLink({ userId: user2.id, shortCode: "u2L01" });

    const res = await request(app).get("/api/public/user1pub/links");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe(user1.id);
  });

  it("does not require authentication", async () => {
    const app = await getServer();
    const user = await createUser({ username: "noauthlinks", email: "nal@example.com" });
    await createLink({ userId: user.id, shortCode: "nal001" });

    const res = await request(app).get("/api/public/noauthlinks/links");

    expect(res.status).toBe(200);
  });
});
