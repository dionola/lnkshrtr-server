import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { verifyToken } from '../../lib/jwt';
import { AppError } from '../filters/http-exception.filter';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

    let payload: { sub: string };
    try {
      payload = verifyToken(authHeader.slice(7));
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');

    req.user = user;
    return true;
  }
}
