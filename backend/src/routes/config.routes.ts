import { Router } from "express";
import { prisma } from "../db/prisma";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { listOllamaModels } from "../services/ollama.service";
import { textToSpeech } from "../services/tts.service";
import { env } from "../config/env";

const execFileP = promisify(execFile);

export const configRouter = Router();

const schema = z.object({
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  ttsEnabled: z.boolean().optional(),
  sttEnabled: z.boolean().optional(),
  ttsVoice: z.string().nullable().optional(),
  ttsRate: z.number().int().min(80).max(500).nullable().optional(),
  language: z.enum(["en", "es"]).optional(),
  systemPromptEn: z.string().nullable().optional(),
  systemPromptEs: z.string().nullable().optional(),
});

configRouter.get("/", async (_req, res) => {
  const cfg = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  res.json(cfg);
});

/** Returns what capabilities are actually available on this system */
configRouter.get("/capabilities", async (_req, res) => {
  const hasSay = process.platform === "darwin" && await execFileP("which", ["say"]).then(() => true).catch(() => false);
  const hasWhisper = !!env.WHISPER_CLI_PATH && !!env.WHISPER_MODEL_PATH;
  const hasFfmpeg = await execFileP("which", ["ffmpeg"]).then(() => true).catch(() => false);
  res.json({ tts: hasSay ? "macos-say" : "none", stt: hasWhisper ? "whisper" : "none", ffmpeg: hasFfmpeg });
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

configRouter.get("/ollama/models", async (_req, res, next) => {
  try {
    const cfg = await prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    const models = await listOllamaModels(cfg.ollamaBaseUrl);
    res.json({ models });
  } catch (err: any) {
    res.status(502).json({ error: "ollama_unreachable", message: err?.message || String(err) });
  }
});

/**
 * Lista las voces disponibles en macOS (`say -v '?'`).
 * Cada línea: "Name              locale    # sample"
 * Devuelve [{name, locale, sample}].
 */
configRouter.get("/tts/voices", async (_req, res) => {
  try {
    const { stdout } = await execFileP("say", ["-v", "?"]);
    const voices = stdout
      .split("\n")
      .map((line) => {
        const m = /^(.+?)\s{2,}([a-z]{2,3}[_-][A-Z]{2})\s*#\s*(.*)$/.exec(line);
        if (!m) return null;
        return { name: m[1].trim(), locale: m[2], sample: m[3].trim() };
      })
      .filter((v): v is { name: string; locale: string; sample: string } => v !== null);
    res.json({ voices });
  } catch (err: any) {
    res.status(503).json({ error: "say_unavailable", message: err?.message || String(err), voices: [] });
  }
});

const previewSchema = z.object({
  voice: z.string().nullable().optional(),
  rate: z.number().int().min(80).max(500).nullable().optional(),
  language: z.enum(["en", "es"]).optional(),
  text: z.string().max(400).optional(),
});

const PREVIEW_TEXT: Record<"en" | "es", string> = {
  en: "Hello, this is a voice preview. The quick brown fox jumps over the lazy dog.",
  es: "Hola, esta es una prueba de voz. El veloz murciélago hindú comía feliz cardillo y kiwi.",
};

configRouter.post("/tts/preview", async (req, res, next) => {
  try {
    const { voice, rate, language, text } = previewSchema.parse(req.body || {});
    const lang: "en" | "es" = language ?? "en";
    const sample = (text && text.trim()) || PREVIEW_TEXT[lang];
    const url = await textToSpeech(sample, { voice: voice ?? null, rate: rate ?? null, ignoreEnabled: true });
    if (!url) {
      res.status(503).json({ error: "tts_unavailable" });
      return;
    }
    res.json({ url, text: sample });
  } catch (err) {
    next(err);
  }
});
