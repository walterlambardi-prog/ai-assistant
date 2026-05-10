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
  secrets: jsonString.optional(),
});

const patchSchema = toolSchema.partial();

/**
 * Redacta el campo `secrets` antes de devolver al cliente.
 * Reemplaza valores no vacíos por "***" preservando las keys.
 */
function redactTool<T extends { secrets?: string | null }>(t: T): T {
  if (!t || !t.secrets) return t;
  try {
    const parsed = JSON.parse(t.secrets) as Record<string, unknown>;
    const redacted: Record<string, string> = {};
    for (const k of Object.keys(parsed)) {
      const v = parsed[k];
      redacted[k] = v === undefined || v === null || v === "" ? "" : "***";
    }
    return { ...t, secrets: JSON.stringify(redacted) };
  } catch {
    return { ...t, secrets: "{}" };
  }
}

toolsRouter.get("/", async (_req, res) => {
  const list = await prisma.tool.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(list.map(redactTool));
});

toolsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = toolSchema.parse(req.body);
    const created = await prisma.tool.create({ data: parsed });
    res.status(201).json(redactTool(created));
  } catch (err) {
    next(err);
  }
});

toolsRouter.get("/:id", async (req, res) => {
  const t = await prisma.tool.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: "not_found" });
  res.json(redactTool(t));
});

toolsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.parse(req.body);
    // Si vienen secrets, mergear con los existentes y descartar valores "***" (placeholder de UI)
    let data: Record<string, unknown> = { ...parsed };
    if (parsed.secrets !== undefined) {
      const existing = await prisma.tool.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "not_found" });
      const incoming = JSON.parse(parsed.secrets || "{}") as Record<string, unknown>;
      const current = JSON.parse(existing.secrets || "{}") as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...current };
      for (const [k, v] of Object.entries(incoming)) {
        // Si el valor es "***" mantener el secreto existente
        if (v === "***") continue;
        if (v === "" || v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }
      // Borrar keys que el usuario removió (no presentes en incoming)
      for (const k of Object.keys(current)) {
        if (!(k in incoming)) delete merged[k];
      }
      data.secrets = JSON.stringify(merged);
    }
    const updated = await prisma.tool.update({
      where: { id: req.params.id },
      data,
    });
    res.json(redactTool(updated));
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
