import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { env, AUDIO_DIR } from "../config/env";

const execFileP = promisify(execFile);

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!env.STT_ENABLED) {
    throw new Error("STT no configurado (STT_ENABLED=false)");
  }
  if (!env.WHISPER_CLI_PATH || !env.WHISPER_MODEL_PATH) {
    throw new Error("STT no configurado (WHISPER_CLI_PATH/WHISPER_MODEL_PATH faltan)");
  }

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const outBase = path.join(AUDIO_DIR, `stt_${Date.now()}`);

  // whisper.cpp CLI: ./main -m model.bin -f input.wav -otxt -of out
  await execFileP(env.WHISPER_CLI_PATH, [
    "-m",
    env.WHISPER_MODEL_PATH,
    "-f",
    filePath,
    "-otxt",
    "-of",
    outBase,
  ]);

  const txtPath = `${outBase}.txt`;
  const text = await fs.readFile(txtPath, "utf-8").catch(() => "");
  await fs.unlink(txtPath).catch(() => undefined);
  return text.trim();
}
