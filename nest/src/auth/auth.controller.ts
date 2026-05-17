import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { signToken } from '../lib/jwt';
import { env } from '../config/env';
import { AuthGuard } from '../common/guards/auth.guard';
import { AppError } from '../common/filters/http-exception.filter';
import { LoginDto, SignupDto } from '../dto/auth.dto';
import { userResponseSchema, authResponseSchema } from '../schemas/auth.schemas';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function googleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
}

function safeUsername(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized.slice(0, 40) || 'user';
}

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService) {}

  @Post('signup')
  async signup(@Body() body: SignupDto) {
    const { username, email, password } = body;
    const normalizedEmail = email.toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === normalizedEmail) throw new AppError(409, 'CONFLICT', 'Email is already taken');
    if (existing?.username === username) throw new AppError(409, 'CONFLICT', 'Username is already taken');

    const hashed = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({ data: { username, email: normalizedEmail, password: hashed } });

    return authResponseSchema.parse({ user, accessToken: signToken(user.id) });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const { email, password } = body;

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
  googleInit(@Res() res: Response) {
    if (!googleConfigured()) {
      throw new AppError(501, 'NOT_CONFIGURED', 'Google OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: env.GOOGLE_CALLBACK_URL!,
      response_type: 'code',
      scope: 'openid email profile',
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  }

  @Get('google/callback')
  async googleCallback(@Request() req: any, @Res() res: Response) {
    if (!googleConfigured()) {
      throw new AppError(501, 'NOT_CONFIGURED', 'Google OAuth is not configured');
    }

    const code = req.query?.code;
    if (typeof code !== 'string' || !code) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing authorization code');
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to exchange OAuth code');

    const tokenBody = await tokenResponse.json() as { access_token?: string };
    if (!tokenBody.access_token) throw new AppError(500, 'INTERNAL_ERROR', 'Google did not return an access token');

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!userInfoResponse.ok) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch user info from Google');

    const info = await userInfoResponse.json() as { email?: string; name?: string; given_name?: string };
    const email = info.email?.toLowerCase();
    if (!email) throw new AppError(500, 'INTERNAL_ERROR', 'Google account did not include an email');

    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) return existing;

      const base = safeUsername(info.name ?? info.given_name ?? email.split('@')[0]);
      let username = base;
      let suffix = 1;
      while (await tx.user.findUnique({ where: { username } })) {
        username = `${base}_${suffix++}`;
      }

      return tx.user.create({ data: { email, username, password: null } });
    });

    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${signToken(user.id)}`);
  }
}
