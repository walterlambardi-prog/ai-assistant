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
    options: {
      temperature: input.temperature ?? env.DEFAULT_TEMPERATURE,
      top_p: input.topP ?? env.DEFAULT_TOP_P,
    },
  };
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools;
  }

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

  return (await res.json()) as OllamaChatResponse;
}
