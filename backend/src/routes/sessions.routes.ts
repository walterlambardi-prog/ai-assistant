import { Router } from "express";
import { prisma } from "../db/prisma";
import { z } from "zod";

export const sessionsRouter = Router();

const createSchema = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const patchSchema = createSchema.partial();

sessionsRouter.get("/", async (_req, res) => {
  const list = await prisma.session.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(list);
});

sessionsRouter.post("/", async (req, res) => {
  const parsed = createSchema.parse(req.body || {});
  const created = await prisma.session.create({
    data: {
      title: parsed.title || "Nueva sesión",
      model: parsed.model,
      systemPrompt: parsed.systemPrompt,
    },
  });
  res.status(201).json(created);
});

sessionsRouter.get("/:id", async (req, res) => {
  const s = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!s) return res.status(404).json({ error: "not_found" });
  res.json(s);
});

sessionsRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema.parse(req.body || {});
  const updated = await prisma.session.update({
    where: { id: req.params.id },
    data: parsed,
  });
  res.json(updated);
});

sessionsRouter.delete("/:id", async (req, res) => {
  await prisma.session.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
