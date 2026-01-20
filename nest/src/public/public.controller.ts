import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../database/redis.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppError } from '../common/filters/http-exception.filter';
import { userResponseSchema } from '../schemas/auth.schemas';
import { getPublicLinksQuerySchema, linkResponseSchema } from '../schemas/links.schemas';

@Controller('public')
export class PublicController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  @Get(':username')
  async getPublicUser(@Param('username') username: string) {
    const cached = await this.redis.getJson(`public:user:${username}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const response = userResponseSchema.parse(user);
    await this.redis.set(`public:user:${username}`, response);
    return response;
  }

  @Get(':username/links')
  async getPublicLinks(@Param('username') username: string, @Query(new ZodValidationPipe(getPublicLinksQuerySchema)) query: unknown) {
    const { type } = getPublicLinksQuerySchema.parse(query);
    const cacheKey = type ? `public:links:${username}:${type}` : `public:links:${username}`;
    const cached = await this.redis.getJson(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const links = await this.prisma.link.findMany({
      where: { userId: user.id, isPublic: true, isActive: true, ...(type && { type }) },
      orderBy: { createdAt: 'desc' },
    });

    const response = links.map((l) => linkResponseSchema.parse(l));
    await this.redis.set(cacheKey, response);
    return response;
  }
}
