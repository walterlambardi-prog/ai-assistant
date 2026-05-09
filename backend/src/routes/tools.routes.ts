import { Router } from "express";
import { prisma } from "../db/prisma";
import { z } from "zod";
import {
  getToolByName,
  applyDefaults,
  validateToolArguments,
} from "../services/dynamic-tools.service";
import { executeHttpTool } from "../services/http-tool-executor.service";

export const toolsRouter = Router();

const jsonString = z
  .string()
  .refine((s) => {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  }, "Debe ser JSON válido");

const toolSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "name inválido"),
  displayName: z.string().min(1),
  description: z.string().min(1),
  usageGuidance: z.string().default(""),
  enabled: z.boolean().default(true),
  type: z.literal("http").default("http"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  url: z.string().url(),
  headers: jsonString.default("{}"),
  queryParams: jsonString.default("{}"),
  bodyTemplate: jsonString.default("{}"),
  parameters: jsonString.default('{"type":"object","properties":{}}'),
  parameterPolicy: jsonString.default("{}"),
  responseMapping: jsonString.default("{}"),
  timeoutMs: z.number().int().positive().max(60000).default(10000),
  maxResponseKb: z.number().int().positive().max(8192).default(256),
  allowedHosts: jsonString.default("[]"),
});

const patchSchema = toolSchema.partial();

toolsRouter.get("/", async (_req, res) => {
  const list = await prisma.tool.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(list);
});

toolsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = toolSchema.parse(req.body);
    const created = await prisma.tool.create({ data: parsed });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

toolsRouter.get("/:id", async (req, res) => {
  const t = await prisma.tool.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: "not_found" });
  res.json(t);
});

toolsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.parse(req.body);
    const updated = await prisma.tool.update({
      where: { id: req.params.id },
      data: parsed,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

toolsRouter.delete("/:id", async (req, res) => {
  await prisma.tool.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

const testSchema = z.object({ args: z.record(z.unknown()).default({}) });

toolsRouter.post("/:id/test", async (req, res, next) => {
  try {
    const t = await prisma.tool.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: "not_found" });

    const tool = await getToolByName(t.name);
    if (!tool) return res.status(404).json({ error: "not_found" });

    const { args } = testSchema.parse(req.body || {});
    const merged = applyDefaults(tool, args);
    const validation = validateToolArguments(tool, merged);
    if (!validation.ok) {
      return res.status(400).json({
        error: "invalid_args",
        details: validation.errors,
        missingRequired: validation.missingRequired,
      });
    }

    const result = await executeHttpTool(tool, validation.value);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
