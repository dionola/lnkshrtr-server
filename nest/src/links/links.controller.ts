import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../database/redis.service';
import { env } from '../config/env';
import { AuthGuard } from '../common/guards/auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppError } from '../common/filters/http-exception.filter';
import { generateUniqueShortCode } from '../lib/shortCode';
import {
  createLinkSchema,
  updateLinkSchema,
  verifyPasswordSchema,
  getUserLinksQuerySchema,
  linkResponseSchema,
} from '../schemas/links.schemas';

function extractTitle(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 50); }
}

@Controller('links')
export class LinksController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  @Get()
  @UseGuards(AuthGuard)
  async getUserLinks(@Request() req: any, @Query(new ZodValidationPipe(getUserLinksQuerySchema)) query: unknown) {
    const userId: string = req.user.id;
    const { type } = getUserLinksQuerySchema.parse(query);

    const cacheKey = type ? `user:links:${userId}:${type}` : `user:links:${userId}`;
    const cached = await this.redis.getJson(cacheKey);
    if (cached) return cached;

    const links = await this.prisma.link.findMany({
      where: { userId, ...(type && { type }) },
      orderBy: { createdAt: 'desc' },
    });

    const response = links.map((l) => linkResponseSchema.parse(l));
    await this.redis.set(cacheKey, response);
    return response;
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  async createLink(@Request() req: any, @Body(new ZodValidationPipe(createLinkSchema)) body: unknown) {
    const parsed = createLinkSchema.parse(body);
    const userId: string | null = req.user?.id ?? null;
    const shortCode = parsed.customCode ?? (await generateUniqueShortCode(this.prisma));
    const hashedPassword = parsed.isPasswordProtected && parsed.password
      ? await bcrypt.hash(parsed.password, env.BCRYPT_ROUNDS)
      : null;

    const link = await this.prisma.$transaction(async (tx) => {
      if (parsed.customCode) {
        const exists = await tx.link.findUnique({ where: { shortCode }, select: { id: true } });
        if (exists) throw new AppError(409, 'CONFLICT', 'Short code is already in use');
      }
      return tx.link.create({
        data: {
          shortCode,
          originalUrl: parsed.url,
          title: extractTitle(parsed.url),
          isPublic: parsed.isPublic,
          isPasswordProtected: parsed.isPasswordProtected,
          password: hashedPassword,
          userId,
          type: parsed.type,
        },
      });
    });

    if (userId) await this.redis.del(`user:links:${userId}`, `user:links:${userId}:link`);
    return linkResponseSchema.parse(link);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateLink(@Request() req: any, @Param('id') id: string, @Body(new ZodValidationPipe(updateLinkSchema)) body: unknown) {
    const parsed = updateLinkSchema.parse(body);
    const userId: string = req.user.id;
    const newPasswordHash = parsed.isPasswordProtected && parsed.password
      ? await bcrypt.hash(parsed.password, env.BCRYPT_ROUNDS)
      : null;

    const link = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.link.findUnique({ where: { id }, select: { userId: true, shortCode: true } });
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Link not found');
      if (existing.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this link');

      const data: Record<string, unknown> = {};
      if (parsed.title !== undefined) data.title = parsed.title;
      if (parsed.isPublic !== undefined) data.isPublic = parsed.isPublic;
      if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
      if (parsed.isPasswordProtected !== undefined) {
        data.isPasswordProtected = parsed.isPasswordProtected;
        if (parsed.isPasswordProtected && newPasswordHash) data.password = newPasswordHash;
        else if (!parsed.isPasswordProtected) data.password = null;
      }

      return tx.link.update({ where: { id }, data });
    });

    await this.redis.del(
      `link:code:${link.shortCode}`,
      `user:links:${userId}`, `user:links:${userId}:link`,
    );
    return linkResponseSchema.parse(link);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async deleteLink(@Request() req: any, @Param('id') id: string) {
    const userId: string = req.user.id;

    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.link.findUnique({ where: { id }, select: { userId: true, shortCode: true } });
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Link not found');
      if (existing.userId !== userId) throw new AppError(403, 'FORBIDDEN', 'You do not own this link');
      await tx.link.delete({ where: { id } });
      return existing;
    });

    await this.redis.del(
      `link:code:${deleted.shortCode}`,
      `user:links:${userId}`, `user:links:${userId}:link`,
    );
  }

  @Get('code/:shortCode')
  async getLinkByCode(@Param('shortCode') shortCode: string) {
    const cacheKey = `link:code:${shortCode}`;
    const cached = await this.redis.getJson(cacheKey);
    if (cached) return cached;

    const link = await this.prisma.link.findUnique({ where: { shortCode } });
    if (!link) throw new AppError(404, 'NOT_FOUND', 'Short code not found');

    const response = linkResponseSchema.parse(link);
    await this.redis.set(cacheKey, response);
    return response;
  }

  @Post('code/:shortCode')
  @HttpCode(HttpStatus.OK)
  async verifyPassword(@Param('shortCode') shortCode: string, @Body(new ZodValidationPipe(verifyPasswordSchema)) body: unknown, @Res() res: Response) {
    const { password } = verifyPasswordSchema.parse(body);
    const link = await this.prisma.link.findUnique({
      where: { shortCode },
      select: { password: true, isPasswordProtected: true },
    });

    if (!link) throw new AppError(404, 'NOT_FOUND', 'Short code not found');
    if (!link.isPasswordProtected || !link.password) {
      res.type('application/json').send(JSON.stringify(true));
      return;
    }

    const result = await bcrypt.compare(password, link.password);
    res.type('application/json').send(JSON.stringify(result));
  }

  @Post('code/:shortCode/click')
  @HttpCode(HttpStatus.OK)
  async recordClick(@Param('shortCode') shortCode: string) {
    this.prisma.link
      .update({ where: { shortCode }, data: { visits: { increment: 1 } } })
      .then(() => this.redis.del(`link:code:${shortCode}`))
      .catch(() => {});

    return {};
  }
}
