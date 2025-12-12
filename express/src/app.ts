import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { env } from "./config/env";
import { configurePassport } from "./config/passport";
import { requestId } from "./middleware/requestId";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import publicRoutes from "./routes/public";
import linksRoutes from "./routes/links";
import { testRouter } from "./routes/test";

configurePassport();

export const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.THROTTLE_LIMIT ?? "500", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests — please try again later" } },
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());
app.use(requestId);
app.use(passport.initialize());

app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

if (process.env.NODE_ENV === "test") app.use("/api/test", testRouter);
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/links", linksRoutes);

app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
app.get("/health/live", (_req, res) => { res.json({ status: "ok", uptime: process.uptime() }); });
app.get("/health/ready", async (_req, res) => {
  const { prisma } = await import("./lib/prisma");
  const { cache } = await import("./lib/redis");
  const checks: Record<string, string> = {};
  try { await prisma.$queryRaw`SELECT 1`; checks.database = "ok"; } catch { checks.database = "error"; }
  checks.redis = (await cache.ping()) ? "ok" : "error";
  const healthy = Object.values(checks).every(s => s === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "ok" : "degraded", timestamp: new Date().toISOString(), checks });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
