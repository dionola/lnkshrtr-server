import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface CreateUserOpts {
  username?: string;
  email?: string;
  password?: string;
  oauth?: boolean;
}

let userCounter = 0;

export async function createUser(opts: CreateUserOpts = {}) {
  const n = ++userCounter;
  const username = opts.username ?? `user${n}`;
  const email = opts.email ?? `user${n}@example.com`;

  const hashedPassword =
    opts.oauth || opts.password === undefined
      ? null
      : await bcrypt.hash(opts.password ?? 'password123', 1);

  return prisma.user.create({
    data: { username, email, password: hashedPassword },
  });
}

export async function createUserWithToken(opts: CreateUserOpts = {}) {
  const user = await createUser(opts);
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { user, token };
}

interface CreateLinkOpts {
  userId?: string | null;
  shortCode?: string;
  originalUrl?: string;
  title?: string;
  isPublic?: boolean;
  isActive?: boolean;
  isPasswordProtected?: boolean;
  password?: string;
  type?: 'link';
  visits?: number;
}

let linkCounter = 0;

export async function createLink(opts: CreateLinkOpts = {}) {
  const n = ++linkCounter;
  const shortCode = opts.shortCode ?? `code${n}x`;

  const hashedPassword =
    opts.isPasswordProtected && opts.password
      ? await bcrypt.hash(opts.password, 1)
      : null;

  return prisma.link.create({
    data: {
      shortCode,
      originalUrl: opts.originalUrl ?? 'https://example.com',
      title: opts.title ?? 'Example',
      isPublic: opts.isPublic ?? true,
      isActive: opts.isActive ?? true,
      isPasswordProtected: opts.isPasswordProtected ?? false,
      password: hashedPassword,
      userId: opts.userId ?? null,
      type: opts.type ?? 'link',
      visits: opts.visits ?? 0,
    },
  });
}

export function makeExpiredToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: -1 });
}

export function makeMalformedToken(): string {
  return 'not.a.real.token';
}
