/**
 * TTSProvider interface — allows swapping the TTS engine without touching
 * the rest of the codebase. Current implementations:
 *   - MacOSSayProvider  (macOS only, uses the `say` CLI)
 *   - NullTTSProvider   (no-op, used when TTS is unavailable)
 */
export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, opts: { voice?: string | null; rate?: number | null }): Promise<string | null>;
  listVoices(): Promise<{ name: string; locale: string; sample: string }[]>;
}

export class NullTTSProvider implements TTSProvider {
  readonly name = "none";
  async synthesize(): Promise<null> { return null; }
  async listVoices() { return []; }
}

/**
 * Auto-detect and return the best available TTS provider.
 * Falls back to NullTTSProvider on non-macOS or if `say` is missing.
 */
export async function detectTTSProvider(): Promise<TTSProvider> {
  if (process.platform !== "darwin") return new NullTTSProvider();
  // Verify `say` is on PATH
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileP = promisify(execFile);
  try {
    await execFileP("which", ["say"]);
    const { MacOSSayProvider } = await import("./tts.service");
    return new MacOSSayProvider();
  } catch {
    return new NullTTSProvider();
  }
}
