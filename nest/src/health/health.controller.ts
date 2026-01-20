import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../database/redis.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('health/live')
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('health/ready')
  async ready(@Res() res: Response) {
    const checks: Record<string, string> = {};
    try { await this.prisma.$queryRaw`SELECT 1`; checks.database = 'ok'; } catch { checks.database = 'error'; }
    checks.redis = (await this.redis.ping()) ? 'ok' : 'error';
    const healthy = Object.values(checks).every(s => s === 'ok');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks });
  }
}
