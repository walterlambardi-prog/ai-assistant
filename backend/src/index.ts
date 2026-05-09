import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { AppError } from "./utils/errors";
import { sessionsRouter } from "./routes/sessions.routes";
import { messagesRouter } from "./routes/messages.routes";
import { toolsRouter } from "./routes/tools.routes";
import { configRouter } from "./routes/config.routes";
import { audioRouter } from "./routes/audio.routes";
import { ZodError } from "zod";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions/:id/messages", messagesRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/config", configRouter);
app.use("/audio", audioRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation_error", details: err.errors });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  logger.error(err);
  const message = (err as Error)?.message || "internal_error";
  res.status(500).json({ error: message });
});

app.listen(env.PORT, () => {
  logger.info(`Backend listening on http://localhost:${env.PORT}`);
});
