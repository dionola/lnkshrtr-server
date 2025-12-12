import { prisma } from "../lib/prisma";

// Wipe the database in dependency order before each test
beforeEach(async () => {
  await prisma.link.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
