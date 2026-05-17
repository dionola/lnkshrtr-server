import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AppError } from '../filters/http-exception.filter';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    return user;
  }

  getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest();
  }
}
