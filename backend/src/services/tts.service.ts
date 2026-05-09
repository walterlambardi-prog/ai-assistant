import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { AUDIO_DIR, env } from "../config/env";

const execFileP = promisify(execFile);

/**
 * Genera un archivo de audio a partir de texto usando `say` (macOS).
 * Devuelve la ruta relativa servible (uploads/audio/...).
 */
export async function textToSpeech(text: string): Promise<string | null> {
  if (!env.TTS_ENABLED) return null;
  if (!text || !text.trim()) return null;

  await fs.mkdir(AUDIO_DIR, { recursive: true });

  const filename = `tts_${Date.now()}.aiff`;
  const fullPath = path.join(AUDIO_DIR, filename);

  try {
    await execFileP("say", ["-o", fullPath, text]);
  } catch (err) {
    // En sistemas no-mac, `say` no existe.
    return null;
  }

  return `audio/${filename}`;
}
