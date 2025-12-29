import request from "supertest";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

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
import {
  createUser,
  createUserWithToken,
  makeExpiredToken,
  makeMalformedToken,
} from "./helpers/factories";

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

describe("POST /api/auth/signup", () => {
  it("registers a new user and returns user + accessToken", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "alice",
      email: "alice@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: "alice",
      email: "alice@example.com",
    });
    expect(res.body.accessToken).toBeDefined();
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("never returns a password field in the response", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "bob",
      email: "bob@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.password).toBeUndefined();
  });

  it("user response includes all expected fields", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "fielduser",
      email: "fielduser@example.com",
      password: "password123",
    });

    const user = res.body.user;
    expect(user.username).toBe("fielduser");
    expect(user.email).toBe("fielduser@example.com");
    expect(user.id).toBeDefined();
    expect(user.createdAt).toBeDefined();
    expect(user.password).toBeUndefined();
  });

  it("password is hashed in the database", async () => {
    const app = await getServer();
    await request(app).post("/api/auth/signup").send({
      username: "hashcheck",
      email: "hashcheck@example.com",
      password: "password123",
    });

    const dbUser = await prisma.user.findUnique({ where: { email: "hashcheck@example.com" } });
    expect(dbUser!.password).not.toBe("password123");
    expect(/^\$2[ab]\$/.test(dbUser!.password!)).toBe(true);
  });

  it("returns a valid JWT payload with sub = user id", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "carol",
      email: "carol@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    const decoded = jwt.decode(res.body.accessToken) as { sub: string };
    expect(decoded.sub).toBe(res.body.user.id);
  });

  it("returns 409 when email is already taken", async () => {
    const app = await getServer();
    await createUser({ email: "taken@example.com", username: "existing1" });

    const res = await request(app).post("/api/auth/signup").send({
      username: "newuser",
      email: "taken@example.com",
      password: "password123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toMatch(/email/i);
  });

  it("returns 409 when username is already taken", async () => {
    const app = await getServer();
    await createUser({ username: "takenname", email: "unique@example.com" });

    const res = await request(app).post("/api/auth/signup").send({
      username: "takenname",
      email: "different@example.com",
      password: "password123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toMatch(/username/i);
  });

  it("returns 400 when username is shorter than 3 characters", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "ab",
      email: "short@example.com",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when password is shorter than 6 characters", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "validname",
      email: "valid@example.com",
      password: "abc",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when email is invalid", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "validname",
      email: "not-an-email",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when username is missing", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      email: "missing@example.com",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when email is missing", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "validuser",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when password is missing", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "validuser",
      email: "valid@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is empty", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not JSON", async () => {
    const app = await getServer();
    const res = await request(app)
      .post("/api/auth/signup")
      .set("Content-Type", "text/plain")
      .send("not json");

    expect(res.status).toBe(400);
  });

  it("username exactly 3 characters is accepted", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "abc",
      email: "abc@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
  });

  it("password exactly 6 characters is accepted", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "sixpass",
      email: "sixpass@example.com",
      password: "123456",
    });

    expect(res.status).toBe(201);
  });

  it("access token is a valid JWT signed with the app secret", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/signup").send({
      username: "jwtcheck",
      email: "jwtcheck@example.com",
      password: "password123",
    });

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET!) as { sub: string };
    expect(decoded.sub).toBe(res.body.user.id);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns user and accessToken with valid credentials", async () => {
    const app = await getServer();
    await createUser({ email: "login@example.com", password: "secret99" });

    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "secret99",
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "login@example.com" });
    expect(res.body.accessToken).toBeDefined();
  });

  it("returns the correct user matching the credentials", async () => {
    const app = await getServer();
    await createUser({ email: "correctuser@example.com", password: "secret99", username: "correctuser" });

    const res = await request(app).post("/api/auth/login").send({
      email: "correctuser@example.com",
      password: "secret99",
    });

    expect(res.body.user.email).toBe("correctuser@example.com");
  });

  it("never returns a password field", async () => {
    const app = await getServer();
    await createUser({ email: "nopw@example.com", password: "secret99" });

    const res = await request(app).post("/api/auth/login").send({
      email: "nopw@example.com",
      password: "secret99",
    });

    expect(res.body.user.password).toBeUndefined();
  });

  it("returns 401 for wrong password", async () => {
    const app = await getServer();
    await createUser({ email: "wrong@example.com", password: "correctpass" });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrong@example.com",
      password: "wrongpass",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for non-existent email", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "password123",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for OAuth user who has no password", async () => {
    const app = await getServer();
    await createUser({ email: "oauth@example.com", oauth: true });

    const res = await request(app).post("/api/auth/login").send({
      email: "oauth@example.com",
      password: "anypassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 400 when email is missing", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/login").send({
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when password is missing", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/login").send({
      email: "valid@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 with invalid email format", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "password123",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is empty", async () => {
    const app = await getServer();
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not distinguish between wrong email vs wrong password (timing-safe message)", async () => {
    const app = await getServer();
    await createUser({ email: "real@example.com", password: "realpass" });

    const badEmailRes = await request(app).post("/api/auth/login").send({
      email: "fake@example.com",
      password: "realpass",
    });
    const badPassRes = await request(app).post("/api/auth/login").send({
      email: "real@example.com",
      password: "wrongpass",
    });

    expect(badEmailRes.body.error.message).toBe(badPassRes.body.error.message);
  });

  it("returns 401 for an empty password string", async () => {
    const app = await getServer();
    await createUser({ email: "emptypw@example.com", password: "secret99" });

    const res = await request(app).post("/api/auth/login").send({
      email: "emptypw@example.com",
      password: "",
    });

    expect(res.status).toBe(401);
  });

  it("email matching is case-insensitive", async () => {
    const app = await getServer();
    await createUser({ email: "casecheck@example.com", password: "secret99" });

    const res = await request(app).post("/api/auth/login").send({
      email: "CASECHECK@EXAMPLE.COM",
      password: "secret99",
    });

    expect(res.status).toBe(200);
  });

  it("access token contains the correct user id as sub", async () => {
    const app = await getServer();
    const user = await createUser({ email: "tokencheck@example.com", password: "secret99" });

    const res = await request(app).post("/api/auth/login").send({
      email: "tokencheck@example.com",
      password: "secret99",
    });

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET!) as { sub: string };
    expect(decoded.sub).toBe(user.id);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns the authenticated user", async () => {
    const app = await getServer();
    const { user, token } = await createUserWithToken({
      username: "meuser",
      email: "me@example.com",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe("meuser");
    expect(res.body.email).toBe("me@example.com");
  });

  it("never returns a password field", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken({ password: "secret" });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.password).toBeUndefined();
  });

  it("returns 401 when no Authorization header", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a malformed token", async () => {
    const app = await getServer();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${makeMalformedToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for an expired token", async () => {
    const app = await getServer();
    const { user } = await createUserWithToken();
    const expired = makeExpiredToken(user.id);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when Authorization header has wrong scheme", async () => {
    const app = await getServer();
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Basic ${token}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 when token references a deleted user", async () => {
    const app = await getServer();
    const fakeToken = signFakeToken("00000000-0000-0000-0000-000000000000");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

// ─── GET /api/auth/google ─────────────────────────────────────────────────────

describe("GET /api/auth/google", () => {
  it("returns 501 when Google OAuth is not configured", async () => {
    const app = await getServer();
    const res = await request(app).get("/api/auth/google");

    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_CONFIGURED");
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signFakeToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}
