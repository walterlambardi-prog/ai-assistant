import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { env, AUDIO_DIR } from "../config/env";

const execFileP = promisify(execFile);

async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP("which", [bin]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Convierte cualquier audio a WAV 16kHz mono PCM usando ffmpeg.
 * Whisper.cpp requiere ese formato.
 */
async function convertToWav16k(inputPath: string): Promise<string> {
  const ffmpeg = (await which("ffmpeg")) || "ffmpeg";
  const outPath = inputPath.replace(/\.[^.]+$/, "") + "_16k.wav";
  try {
    await execFileP(ffmpeg, [
      "-y",
      "-i", inputPath,
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      outPath,
    ]);
  } catch (err: any) {
    throw new Error(
      `ffmpeg falló al convertir el audio. ¿Está instalado? (brew install ffmpeg). Detalle: ${err?.message || err}`
    );
  }
  return outPath;
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!env.STT_ENABLED) {
    throw new Error("STT no configurado (STT_ENABLED=false en .env)");
  }
  if (!env.WHISPER_CLI_PATH || !env.WHISPER_MODEL_PATH) {
    throw new Error(
      "STT no configurado: faltan WHISPER_CLI_PATH y/o WHISPER_MODEL_PATH en .env"
    );
  }

  // Verificar que existan
  try {
    await fs.access(env.WHISPER_CLI_PATH);
  } catch {
    throw new Error(`WHISPER_CLI_PATH no existe: ${env.WHISPER_CLI_PATH}`);
  }
  try {
    await fs.access(env.WHISPER_MODEL_PATH);
  } catch {
    throw new Error(`WHISPER_MODEL_PATH no existe: ${env.WHISPER_MODEL_PATH}`);
  }

  await fs.mkdir(AUDIO_DIR, { recursive: true });

  // Convertir a WAV 16k mono (lo que whisper.cpp necesita)
  const wavPath = await convertToWav16k(filePath);

  const outBase = path.join(AUDIO_DIR, `stt_${Date.now()}`);

  // whisper.cpp CLI: -m model -f wav -otxt -of out -l auto
  try {
    await execFileP(env.WHISPER_CLI_PATH, [
      "-m", env.WHISPER_MODEL_PATH,
      "-f", wavPath,
      "-otxt",
      "-of", outBase,
      "-l", "auto",
      "-nt", // no timestamps
    ]);
  } catch (err: any) {
    throw new Error(`whisper-cli falló: ${err?.message || err}`);
  } finally {
    await fs.unlink(wavPath).catch(() => undefined);
  }

  const txtPath = `${outBase}.txt`;
  const text = await fs.readFile(txtPath, "utf-8").catch(() => "");
  await fs.unlink(txtPath).catch(() => undefined);
  return text.trim();
}
