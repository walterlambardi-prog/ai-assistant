import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db/prisma";
import { z } from "zod";
import { runChatTurn, runChatTurnStreaming } from "../services/chat-orchestrator.service";
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
  // Filter out intermediate assistant messages (used only for LLM history reconstruction).
  const visible = list.filter((m) => {
    if (!m.metadata) return true;
    try {
      return !(JSON.parse(m.metadata) as { _intermediate?: boolean })._intermediate;
    } catch {
      return true;
    }
  });
  res.json(visible);
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

/** SSE streaming endpoint — same as /text but streams tokens as they arrive */
messagesRouter.post("/text/stream", async (req, res, next) => {
  try {
    const sessionId = (req.params as any).id as string;
    const { content } = textBody.parse(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    await runChatTurnStreaming({
      sessionId,
      userContent: content,
      inputType: "text",
      callbacks: {
        onToolStart: (d) => send("tool_start", d),
        onToolEnd: (d) => send("tool_end", d),
        onToken: (token) => send("token", { text: token }),
        onDone: (result) => send("done", { assistantMessageId: result.assistantMessageId, toolCalls: result.toolCalls }),
      },
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

messagesRouter.post("/voice/transcribe", upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "audio file missing" });
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
    res.json({ transcript, audioUrl: `audio/${finalName}` });
  } catch (err) {
    next(err);
  }
});

const voiceRunBody = z.object({
  transcript: z.string().min(1),
  audioUrl: z.string().nullable().optional(),
});

messagesRouter.post("/voice/run", async (req, res, next) => {
  try {
    const sessionId = (req.params as any).id as string;
    const { transcript, audioUrl: userAudioUrl } = voiceRunBody.parse(req.body);

    const result = await runChatTurn({
      sessionId,
      userContent: transcript,
      inputType: "voice",
      userAudioUrl: userAudioUrl ?? null,
    });

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
