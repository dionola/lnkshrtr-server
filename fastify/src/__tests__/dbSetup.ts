import { prisma } from "../lib/prisma";

beforeEach(async () => {
  await prisma.link.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
