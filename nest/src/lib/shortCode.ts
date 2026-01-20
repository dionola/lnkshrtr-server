import { PrismaService } from '../database/prisma.service';

function generate(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function generateUniqueShortCode(prisma: PrismaService): Promise<string> {
  let code = generate();
  while (await prisma.link.findUnique({ where: { shortCode: code } })) {
    code = generate();
  }
  return code;
}
