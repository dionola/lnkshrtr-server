import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { signToken } from '../lib/jwt';
import { env } from '../config/env';
import { AuthGuard } from '../common/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AppError } from '../common/filters/http-exception.filter';
import {
  signupSchema,
  loginSchema,
  userResponseSchema,
  authResponseSchema,
} from '../schemas/auth.schemas';

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  @Post('signup')
  async signup(@Body(new ZodValidationPipe(signupSchema)) body: unknown) {
    const { username, email, password } = signupSchema.parse(body);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === email) throw new AppError(409, 'CONFLICT', 'Email is already taken');
    if (existing?.username === username) throw new AppError(409, 'CONFLICT', 'Username is already taken');

    const hashed = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({ data: { username, email: email.toLowerCase(), password: hashed } });

    return authResponseSchema.parse({ user, accessToken: signToken(user.id) });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: unknown) {
    const { email, password } = loginSchema.parse(body);

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.password) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    return authResponseSchema.parse({ user, accessToken: signToken(user.id) });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Request() req: any) {
    return userResponseSchema.parse(req.user);
  }

  @Get('google')
  googleNotConfigured() {
    throw new AppError(501, 'NOT_CONFIGURED', 'Google OAuth is not configured');
  }

  @Get('google/callback')
  googleCallback() {
    throw new AppError(501, 'NOT_CONFIGURED', 'Google OAuth is not configured');
  }
}
