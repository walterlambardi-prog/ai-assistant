import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db/prisma";
import { z } from "zod";
import { runChatTurn } from "../services/chat-orchestrator.service";
import { textToSpeech } from "../services/tts.service";
import { transcribeAudio } from "../services/stt.service";
import { AUDIO_DIR } from "../config/env";

export const messagesRouter = Router({ mergeParams: true });

const upload = multer({
  dest: AUDIO_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
});

messagesRouter.get("/", async (req, res) => {
  const sessionId = (req.params as any).id as string;
  const list = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  res.json(list);
});

const textBody = z.object({ content: z.string().min(1) });

messagesRouter.post("/text", async (req, res, next) => {
  try {
    const sessionId = (req.params as any).id as string;
    const { content } = textBody.parse(req.body);
    const result = await runChatTurn({ sessionId, userContent: content, inputType: "text" });
    res.json({
      assistantMessageId: result.assistantMessageId,
      content: result.finalText,
      toolCalls: result.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        ok: tc.result.ok,
      })),
    });
  } catch (err) {
    next(err);
  }
});

messagesRouter.post("/voice", upload.single("audio"), async (req, res, next) => {
  try {
    const sessionId = (req.params as any).id as string;
    if (!req.file) return res.status(400).json({ error: "audio file missing" });

    // Mover a destino estable
    await fs.mkdir(AUDIO_DIR, { recursive: true });
    const ext = path.extname(req.file.originalname || "") || ".webm";
    const finalName = `in_${Date.now()}${ext}`;
    const finalPath = path.join(AUDIO_DIR, finalName);
    await fs.rename(req.file.path, finalPath);

    let transcript = "";
    try {
      transcript = await transcribeAudio(finalPath);
    } catch (err: any) {
      return res.status(501).json({ error: "stt_unavailable", message: err.message });
    }

    if (!transcript) {
      return res.status(400).json({ error: "empty_transcript" });
    }

    const result = await runChatTurn({
      sessionId,
      userContent: transcript,
      inputType: "voice",
    });

    // TTS de la respuesta
    let audioUrl: string | null = null;
    try {
      audioUrl = await textToSpeech(result.finalText);
    } catch {
      audioUrl = null;
    }

    if (audioUrl) {
      await prisma.message.update({
        where: { id: result.assistantMessageId },
        data: { audioUrl, outputType: "text_voice" },
      });
    }

    res.json({
      transcript,
      content: result.finalText,
      audioUrl,
      assistantMessageId: result.assistantMessageId,
      toolCalls: result.toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        ok: tc.result.ok,
      })),
    });
  } catch (err) {
    next(err);
  }
});
