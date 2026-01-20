import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { verifyToken } from '../../lib/jwt';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) return true;

    try {
      const payload = verifyToken(authHeader.slice(7));
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, email: true, createdAt: true },
      });
      if (user) req.user = user;
    } catch {
      // optional — silently ignore invalid tokens
    }

    return true;
  }
}
