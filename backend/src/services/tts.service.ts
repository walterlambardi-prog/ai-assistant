import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { AUDIO_DIR, env } from "../config/env";
import { prisma } from "../db/prisma";

const execFileP = promisify(execFile);

async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP("which", [bin]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getTtsConfig(): Promise<{ voice: string | null; rate: number | null }> {
  try {
    const cfg = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
    return {
      voice: cfg?.ttsVoice ?? env.TTS_VOICE ?? null,
      rate: cfg?.ttsRate ?? env.TTS_RATE ?? null,
    };
  } catch {
    return { voice: env.TTS_VOICE ?? null, rate: env.TTS_RATE ?? null };
  }
}

/**
 * Limpia markdown, URLs, emojis y otros símbolos que ensucian la lectura
 * por TTS. Devuelve un texto plano "leíble".
 */
export function sanitizeForTts(input: string): string {
  if (!input) return "";
  let s = input;

  // Bloques de código ``` ... ```
  s = s.replace(/```[\s\S]*?```/g, " ");
  // Inline code `code`
  s = s.replace(/`([^`]*)`/g, "$1");

  // Imágenes ![alt](url)  -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Links de referencia [text][ref] -> text
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  // URLs sueltas
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/www\.\S+/gi, " ");
  // Emails
  s = s.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ");

  // Headings ###, **bold**, *italic*, __underline__
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/(\*\*|__)(.*?)\1/g, "$2");
  s = s.replace(/(\*|_)([^*_\n]+)\1/g, "$2");

  // Separadores --- *** ___
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");

  // Bullets y números al inicio: -, *, +, 1.
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  // Blockquote >
  s = s.replace(/^\s*>+\s?/gm, "");

  // Tablas: pipes
  s = s.replace(/\|/g, " ");

  // Emojis y símbolos pictográficos
  s = s.replace(
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    " "
  );
  // Variation selectors / ZWJ
  s = s.replace(/[\u200D\uFE0F]/g, "");

  // Caracteres residuales que el TTS lee
  s = s.replace(/[#*_~`]+/g, " ");

  // Colapsar líneas en blanco múltiples y espacios
  s = s.replace(/\n{2,}/g, ". ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\s+([.,;:!?])/g, "$1");
  s = s.replace(/\.{2,}/g, ".");
  s = s.trim();

  // Limitar longitud para evitar audios eternos
  const MAX = 4000;
  if (s.length > MAX) s = s.slice(0, MAX) + "…";

  return s;
}

/**
 * Genera audio a partir de texto usando `say` (macOS) y lo convierte
 * a MP3 con ffmpeg para máxima compatibilidad con navegadores
 * (Chrome/Edge no reproducen .aiff).
 * Devuelve la ruta relativa servible (audio/...).
 */
export async function textToSpeech(
  text: string,
  options?: { voice?: string | null; rate?: number | null; ignoreEnabled?: boolean; skipSanitize?: boolean }
): Promise<string | null> {
  if (!options?.ignoreEnabled && !env.TTS_ENABLED) return null;
  const cleaned = options?.skipSanitize ? text : sanitizeForTts(text);
  if (!cleaned || !cleaned.trim()) return null;

  await fs.mkdir(AUDIO_DIR, { recursive: true });

  const ts = Date.now();
  const aiffPath = path.join(AUDIO_DIR, `tts_${ts}.aiff`);
  let voice: string | null;
  let rate: number | null;
  if (options && (options.voice !== undefined || options.rate !== undefined)) {
    voice = options.voice ?? null;
    rate = options.rate ?? null;
  } else {
    const cfg = await getTtsConfig();
    voice = cfg.voice;
    rate = cfg.rate;
  }

  try {
    const sayArgs = ["-o", aiffPath];
    if (voice) sayArgs.push("-v", voice);
    if (rate) sayArgs.push("-r", String(rate));
    sayArgs.push(cleaned);
    await execFileP("say", sayArgs);
  } catch {
    // En sistemas no-mac, `say` no existe.
    return null;
  }

  // Convertir a MP3 si hay ffmpeg
  const ffmpeg = await which("ffmpeg");
  if (ffmpeg) {
    const mp3Path = path.join(AUDIO_DIR, `tts_${ts}.mp3`);
    try {
      await execFileP(ffmpeg, [
        "-y",
        "-i", aiffPath,
        "-codec:a", "libmp3lame",
        "-qscale:a", "4",
        mp3Path,
      ]);
      await fs.unlink(aiffPath).catch(() => undefined);
      return `audio/${path.basename(mp3Path)}`;
    } catch {
      // Si falla la conversión, devolvemos AIFF (funciona en Safari)
      return `audio/${path.basename(aiffPath)}`;
    }
  }

  // Sin ffmpeg, devolvemos AIFF (funciona en Safari)
  return `audio/${path.basename(aiffPath)}`;
}

/**
 * Concrete TTSProvider implementation using macOS `say`.
 * Exported so tts-provider.ts can import it dynamically.
 */
export class MacOSSayProvider {
  readonly name = "macos-say";

  async synthesize(text: string, opts: { voice?: string | null; rate?: number | null }): Promise<string | null> {
    return textToSpeech(text, { voice: opts.voice, rate: opts.rate, ignoreEnabled: true });
  }

  async listVoices(): Promise<{ name: string; locale: string; sample: string }[]> {
    try {
      const { stdout } = await execFileP("say", ["-v", "?"]);
      return stdout
        .split("\n")
        .map((line) => {
          const m = /^(.+?)\s{2,}([a-z]{2,3}[_-][A-Z]{2})\s*#\s*(.*)$/.exec(line);
          if (!m) return null;
          return { name: m[1].trim(), locale: m[2], sample: m[3].trim() };
        })
        .filter((v): v is { name: string; locale: string; sample: string } => v !== null);
    } catch {
      return [];
    }
  }
}
