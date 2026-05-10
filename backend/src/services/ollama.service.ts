import { env } from "../config/env";
import { logger } from "../utils/logger";

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: Array<{
    id?: string;
    function: { name: string; arguments: Record<string, unknown> };
  }>;
};

export type OllamaChatInput = {
  model: string;
  messages: OllamaMessage[];
  tools?: any[];
  temperature?: number;
  topP?: number;
  keepAlive?: string;
};

export type OllamaChatResponse = {
  model: string;
  message: OllamaMessage;
  done: boolean;
};

export async function chatWithOllama(input: OllamaChatInput, baseUrl?: string): Promise<OllamaChatResponse> {
  const url = `${baseUrl || env.OLLAMA_BASE_URL}/api/chat`;
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: false,
    keep_alive: input.keepAlive ?? "24h",
    options: {
      temperature: input.temperature ?? env.DEFAULT_TEMPERATURE,
      top_p: input.topP ?? env.DEFAULT_TOP_P,
    },
  };
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools;
  }

  const t0 = Date.now();
  logger.debug("Ollama request", { url, model: input.model, toolCount: input.tools?.length || 0 });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as OllamaChatResponse;
  logger.info(`[ollama] ${input.model} ${Date.now() - t0}ms tools=${input.tools?.length || 0}`);
  return json;
}

/**
 * Streams a chat response from Ollama token by token.
 * Yields each text token as it arrives. The final chunk has `done: true`
 * and includes the full (assembled) response for metadata use.
 */
export async function* streamChatFromOllama(
  input: OllamaChatInput,
  baseUrl?: string
): AsyncGenerator<{ token: string; done: false } | { token: string; done: true; fullResponse: OllamaChatResponse }> {
  const url = `${baseUrl || env.OLLAMA_BASE_URL}/api/chat`;
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: true,
    keep_alive: input.keepAlive ?? "24h",
    options: {
      temperature: input.temperature ?? env.DEFAULT_TEMPERATURE,
      top_p: input.topP ?? env.DEFAULT_TOP_P,
    },
  };
  if (input.tools && input.tools.length > 0) body.tools = input.tools;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}: ${text}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as OllamaChatResponse;
        const token = chunk.message?.content ?? "";
        assembled += token;
        if (chunk.done) {
          yield { token, done: true, fullResponse: { ...chunk, message: { ...chunk.message, content: assembled } } };
        } else {
          yield { token, done: false };
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}

export async function listOllamaModels(baseUrl?: string): Promise<{ name: string; size?: number; modified_at?: string }[]> {
  const url = `${baseUrl || env.OLLAMA_BASE_URL}/api/tags`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = (await res.json()) as { models?: { name: string; size?: number; modified_at?: string }[] };
  return data.models || [];
}
