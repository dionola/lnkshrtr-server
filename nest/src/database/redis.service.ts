import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  onModuleInit() {
    if (!env.REDIS_URL) return;
    this.client = new Redis(env.REDIS_URL, { lazyConnect: false, enableOfflineQueue: false });
    this.client.on('error', () => {});
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try { return await this.client.get(key); } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.client) return;
    try { await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch {}
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try { await this.client.del(...keys); } catch {}
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try { return (await this.client.ping()) === 'PONG'; } catch { return false; }
  }
}
