import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const testRouter: Router = Router();

testRouter.delete("/reset", async (_req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== "test") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only available in test mode" } });
    return;
  }

  await prisma.link.deleteMany();
  await prisma.user.deleteMany();
  res.status(204).send();
});
