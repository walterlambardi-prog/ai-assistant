import { Router } from "express";
import { prisma } from "../db/prisma";
import { z } from "zod";

export const configRouter = Router();

const schema = z.object({
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  ttsEnabled: z.boolean().optional(),
  sttEnabled: z.boolean().optional(),
});

configRouter.get("/", async (_req, res) => {
  const cfg = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  res.json(cfg);
});

configRouter.patch("/", async (req, res, next) => {
  try {
    const parsed = schema.parse(req.body || {});
    const cfg = await prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: parsed,
      create: { id: "singleton", ...parsed },
    });
    res.json(cfg);
  } catch (err) {
    next(err);
  }
});
