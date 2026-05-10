import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || "qwen2.5:7b",
  DEFAULT_TEMPERATURE: parseFloat(process.env.DEFAULT_TEMPERATURE || "0.3"),
  DEFAULT_TOP_P: parseFloat(process.env.DEFAULT_TOP_P || "0.9"),
  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
  TTS_ENABLED: (process.env.TTS_ENABLED || "true") === "true",
  TTS_VOICE: process.env.TTS_VOICE || "Monica",
  TTS_RATE: parseInt(process.env.TTS_RATE || "190", 10),
  STT_ENABLED: (process.env.STT_ENABLED || "false") === "true",
  WHISPER_CLI_PATH: process.env.WHISPER_CLI_PATH || "",
  WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH || "",
};

export const AUDIO_DIR = path.join(env.UPLOAD_DIR, "audio");
