import { prisma } from "./prisma";

function generate(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function generateUniqueShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate();
    const exists = await prisma.link.findUnique({ where: { shortCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique short code after 10 attempts");
}
