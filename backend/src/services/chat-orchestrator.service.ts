import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { chatWithOllama, OllamaMessage } from "./ollama.service";
import {
  getEnabledTools,
  getToolByName,
  getToolDefinitionsForOllama,
  getServicesDescriptionForPrompt,
  applyDefaults,
  validateToolArguments,
  ToolWithParsed,
} from "./dynamic-tools.service";
import { executeHttpTool } from "./http-tool-executor.service";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT_TEMPLATE = `Eres un asistente conversacional local.

Puedes conversar normalmente con el usuario.

También tienes acceso a servicios externos dinámicos provistos por el backend.

Servicios disponibles actualmente:
{{SERVICES_LIST}}

Reglas:
- Si el usuario pregunta qué servicios tienes, lista los servicios disponibles en lenguaje simple.
- No menciones nombres técnicos de tools salvo que el usuario lo pida.
- Si una consulta requiere datos actuales o externos, usa la tool adecuada.
- Antes de llamar una tool, revisa su schema.
- Si faltan parámetros requeridos y no hay default, pregunta al usuario antes de usar la tool.
- Si un parámetro opcional ayudaría mucho, puedes hacer una sola pregunta aclaratoria.
- Si no existe una tool adecuada, dilo claramente.
- Nunca inventes datos actuales si hay una tool apropiada.
- Después de recibir resultado de una tool, resume la información de forma útil.`;

async function buildSystemPrompt(custom?: string | null): Promise<string> {
  const services = await getServicesDescriptionForPrompt();
  const base = SYSTEM_PROMPT_TEMPLATE.replace("{{SERVICES_LIST}}", services);
  if (custom && custom.trim()) {
    return `${base}\n\nInstrucciones adicionales:\n${custom.trim()}`;
  }
  return base;
}

async function loadHistory(sessionId: string): Promise<OllamaMessage[]> {
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, name: m.toolName || undefined };
    }
    return { role: m.role as OllamaMessage["role"], content: m.content };
  });
}

async function getConfig() {
  const cfg = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return cfg;
}

export type OrchestrationResult = {
  finalText: string;
  assistantMessageId: string;
  toolCalls: Array<{ name: string; args: any; result: any }>;
};

export async function runChatTurn(input: {
  sessionId: string;
  userContent: string;
  inputType?: "text" | "voice";
}): Promise<OrchestrationResult> {
  const { sessionId, userContent, inputType = "text" } = input;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Sesión no existe");

  const cfg = await getConfig();
  const model = session.model || cfg.defaultModel || env.OLLAMA_DEFAULT_MODEL;

  // 1. Persistir user message
  await prisma.message.create({
    data: {
      sessionId,
      role: "user",
      content: userContent,
      inputType,
      outputType: "none",
    },
  });
  await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });

  // 2. Construir mensajes
  const systemPrompt = await buildSystemPrompt(session.systemPrompt);
  const history = await loadHistory(sessionId);
  const messages: OllamaMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  const tools = await getToolDefinitionsForOllama();

  // 3. Primer llamado a Ollama
  let response = await chatWithOllama(
    {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: cfg.temperature,
      topP: cfg.topP,
    },
    cfg.ollamaBaseUrl
  );

  const toolCalls: OrchestrationResult["toolCalls"] = [];

  // 4. Detectar tool call
  const toolCall = response.message?.tool_calls?.[0];
  if (toolCall) {
    const toolName = toolCall.function.name;
    const rawArgs =
      typeof toolCall.function.arguments === "string"
        ? safeJson(toolCall.function.arguments)
        : toolCall.function.arguments || {};

    const tool = await getToolByName(toolName);

    if (!tool) {
      const errMsg = `La AI intentó usar una tool inexistente: ${toolName}.`;
      const assistant = await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: errMsg,
          outputType: "text",
          metadata: JSON.stringify({ error: "tool_not_found", toolName }),
        },
      });
      return { finalText: errMsg, assistantMessageId: assistant.id, toolCalls };
    }

    if (!tool.enabled) {
      const errMsg = `La tool "${toolName}" está deshabilitada.`;
      const assistant = await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: errMsg,
          outputType: "text",
          metadata: JSON.stringify({ error: "tool_disabled", toolName }),
        },
      });
      return { finalText: errMsg, assistantMessageId: assistant.id, toolCalls };
    }

    // Apply defaults + validate
    const argsWithDefaults = applyDefaults(tool, rawArgs as Record<string, unknown>);
    const validation = validateToolArguments(tool, argsWithDefaults);

    if (!validation.ok && validation.missingRequired.length > 0) {
      // Pedir aclaración
      const question = buildClarifyingQuestion(tool, validation.missingRequired);
      const assistant = await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: question,
          outputType: "text",
          metadata: JSON.stringify({
            kind: "clarify",
            toolName,
            missing: validation.missingRequired,
          }),
        },
      });
      return { finalText: question, assistantMessageId: assistant.id, toolCalls };
    }

    if (!validation.ok) {
      const errMsg = `Parámetros inválidos para "${tool.displayName}": ${validation.errors.join(
        "; "
      )}`;
      const assistant = await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: errMsg,
          outputType: "text",
          metadata: JSON.stringify({ error: "invalid_args", details: validation.errors }),
        },
      });
      return { finalText: errMsg, assistantMessageId: assistant.id, toolCalls };
    }

    // Ejecutar
    const execResult = await executeHttpTool(tool, validation.value);
    const resultContent = JSON.stringify({
      ok: execResult.ok,
      status: execResult.status,
      data: execResult.data,
      error: execResult.error,
    });

    await prisma.message.create({
      data: {
        sessionId,
        role: "tool",
        toolName: tool.name,
        content: resultContent,
        inputType: "tool",
        outputType: "tool_result",
        metadata: JSON.stringify({ args: validation.value, meta: execResult.meta }),
      },
    });

    toolCalls.push({ name: tool.name, args: validation.value, result: execResult });

    // 5. Segunda llamada a Ollama con resultado
    const updatedHistory = await loadHistory(sessionId);
    const messages2: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...updatedHistory,
    ];

    response = await chatWithOllama(
      {
        model,
        messages: messages2,
        tools: tools.length > 0 ? tools : undefined,
        temperature: cfg.temperature,
        topP: cfg.topP,
      },
      cfg.ollamaBaseUrl
    );
  }

  const finalText = response.message?.content || "";
  const assistant = await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: finalText,
      outputType: "text",
    },
  });

  return { finalText, assistantMessageId: assistant.id, toolCalls };
}

function buildClarifyingQuestion(tool: ToolWithParsed, missing: string[]): string {
  const questions = tool.parameterPolicyObj.questions || {};
  const parts = missing.map((p) => questions[p] || `¿Podrías indicarme "${p}"?`);
  return parts.join(" ");
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
