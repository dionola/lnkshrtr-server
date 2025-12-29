import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export let redisClient: Redis | null = null;

if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL, { lazyConnect: true, enableReadyCheck: false });
  redisClient.on("error", (err) => logger.warn("Redis error", { error: err.message }));
}

const TTL = 300;

async function get<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  try {
    const val = await redisClient.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function set(key: string, value: unknown, ttl = TTL): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // non-fatal
  }
}

async function del(key: string): Promise<void> {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch {
    // ignore
  }
}

export const cache = {
  async ping(): Promise<boolean> {
    if (!redisClient) return false;
    try {
      return (await redisClient.ping()) === "PONG";
    } catch {
      return false;
    }
  },

  getLinkByCode: (shortCode: string) => get(`link:code:${shortCode}`),
  setLinkByCode: (shortCode: string, val: unknown) => set(`link:code:${shortCode}`, val),
  invalidateLinkByCode: (shortCode: string) => del(`link:code:${shortCode}`),

  getUserLinks: (userId: string) => get(`user:links:${userId}`),
  setUserLinks: (userId: string, val: unknown) => set(`user:links:${userId}`, val),
  invalidateUserLinks: (userId: string) => del(`user:links:${userId}`),

  getPublicUser: (username: string) => get(`public:user:${username}`),
  setPublicUser: (username: string, val: unknown) => set(`public:user:${username}`, val),
  invalidatePublicUser: (username: string) => del(`public:user:${username}`),

  getPublicLinks: (username: string) => get(`public:links:${username}`),
  setPublicLinks: (username: string, val: unknown) => set(`public:links:${username}`, val),
  invalidatePublicLinks: (username: string) => del(`public:links:${username}`),

  async invalidateAll({ linkCode, userId }: { linkCode?: string; userId?: string }): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (linkCode) tasks.push(del(`link:code:${linkCode}`));
    if (userId) tasks.push(del(`user:links:${userId}`));
    await Promise.all(tasks);
  },
};
