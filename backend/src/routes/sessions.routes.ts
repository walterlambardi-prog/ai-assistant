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

// Búsqueda por título Y contenido de mensajes
sessionsRouter.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    const list = await prisma.session.findMany({ orderBy: { updatedAt: "desc" } });
    return res.json(list);
  }
  // Buscar sesiones cuyo título coincide
  const byTitle = await prisma.session.findMany({
    where: { title: { contains: q } },
    orderBy: { updatedAt: "desc" },
  });
  // Buscar sesiones con mensajes que coinciden (solo user/assistant, no tool)
  const byContent = await prisma.message.findMany({
    where: {
      content: { contains: q },
      role: { in: ["user", "assistant"] },
    },
    select: { sessionId: true },
    distinct: ["sessionId"],
  });
  const contentSessionIds = byContent.map((m) => m.sessionId);
  const byContentSessions = contentSessionIds.length > 0
    ? await prisma.session.findMany({
        where: { id: { in: contentSessionIds } },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  // Unir y deduplicar, orden: título primero, luego contenido
  const seen = new Set<string>();
  const merged: typeof byTitle = [];
  for (const s of [...byTitle, ...byContentSessions]) {
    if (!seen.has(s.id)) { seen.add(s.id); merged.push(s); }
  }
  res.json(merged);
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

sessionsRouter.delete("/", async (_req, res) => {
  await prisma.message.deleteMany({});
  await prisma.session.deleteMany({});
  res.status(204).end();
});

sessionsRouter.delete("/:id", async (req, res) => {
  await prisma.session.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// Señaliza al orquestador que cancele el loop de tool calls de esta sesión.
sessionsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    await prisma.session.update({
      where: { id: req.params.id },
      data: { cancelRequested: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Marca como canceladas las últimas mensajes (user + assistant si existe) del turno en curso.
// Estos mensajes se ocultan al construir el contexto enviado al LLM en próximos turnos.
sessionsRouter.post("/:id/cancel-last", async (req, res) => {
  const sessionId = req.params.id;
  const recent = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 100, // enough to cover any turn with MAX_TOOL_ITERATIONS=10 + many tool calls
  });
  const cancelled: string[] = [];
  // Recorremos desde la más nueva hasta encontrar (e incluir) el último user message.
  for (const m of recent) {
    if (m.role === "system") continue;
    let meta: Record<string, unknown> = {};
    try {
      meta = m.metadata ? JSON.parse(m.metadata) : {};
    } catch {
      meta = {};
    }
    if (meta.cancelled) break; // ya estaba cancelado: no seguir hacia atrás
    meta.cancelled = true;
    await prisma.message.update({
      where: { id: m.id },
      data: { metadata: JSON.stringify(meta) },
    });
    cancelled.push(m.id);
    if (m.role === "user") break; // cubrimos hasta el user del turno actual
  }
  res.json({ cancelled });
});

/** Debug: returns the last N messages exactly as they would be sent to Ollama */
sessionsRouter.get("/:id/debug-history", async (req, res) => {
  const sessionId = req.params.id;
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const history = rows
    .filter((m) => {
      if (!m.metadata) return true;
      try { return !(JSON.parse(m.metadata) as any).cancelled; } catch { return true; }
    })
    .map((m) => ({
      role: m.role,
      name: m.role === "tool" ? m.toolName : undefined,
      contentLength: m.content.length,
      contentPreview: m.content.slice(0, 300),
      createdAt: m.createdAt,
    }));

  const toolResults = history.filter(m => m.role === "tool");
  res.json({
    totalMessages: history.length,
    toolResultCount: toolResults.length,
    toolNames: toolResults.map(m => m.name),
    messages: history,
  });
});
