import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { chatWithOllama, streamChatFromOllama, OllamaMessage } from "./ollama.service";
import {
  getToolByName,
  getToolDefinitionsForOllama,
  getServicesDescriptionForPrompt,
  applyDefaults,
  validateToolArguments,
  ToolWithParsed,
} from "./dynamic-tools.service";
import { executeHttpTool } from "./http-tool-executor.service";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT_TEMPLATES: Record<"en" | "es", string> = {
  en: `You are a local conversational assistant.

You can chat normally with the user. You also have access to dynamic external services provided by the backend.

Currently available services:
{{SERVICES_LIST}}

Rules:
- If the user asks what services you have, list the available services in plain language.
- Do not mention internal tool names unless the user explicitly asks.
- If a request needs current or external data, use the appropriate tool.
- Before calling a tool, review its schema.
- If required parameters are missing and there is no default, ask the user before calling the tool.
- If an optional parameter would help a lot, you may ask a single clarifying question.
- If there is no suitable tool, say so clearly.
- Never invent current data if a suitable tool exists.
- TOOL FAILURES: If a tool returns ok=false, an error field, or empty/null data, you MUST clearly tell the user that you could not retrieve that information (e.g. "I was unable to get [X] — the service returned an error"). NEVER fabricate, guess, or fill in data when a tool has failed. Do not present invented data as if it came from the service.
- MULTI-STEP REQUESTS: If the user asks for several different things (e.g. photos of different subjects, plus an article), decompose the request and call each tool separately in sequence. Do NOT try to satisfy everything in one tool call. Call tool 1, get result, call tool 2, get result, etc., then compose the final answer.
- RE-EXECUTE REQUESTS: If the user asks to "repeat", "redo", "run again", "execute again" or similar for a set of previous tasks, you MUST execute ALL of the tasks in that set by calling each tool separately in sequence — not just the last one. For example, if your previous response listed 4 actions (image search, Wikipedia, price check, etc.), re-execute all 4 of them.
- If the user asks for images, photos, pictures or any visual material about any topic, you MUST call the image search tool (unsplash_search_photos or wikimedia_commons_search). NEVER fabricate or guess image URLs — Unsplash photo IDs do not exist until retrieved from the tool. NEVER use placeholder domains like example.com, placeholder.com, via.placeholder.com, or any invented URL. Always call the tool first, then use the exact URLs from the tool result.
- After receiving a tool result, summarize the information usefully.
- LINKS: If the tool result contains any URLs (article pages, source links, image pages, reference links, etc.), include them in your response as Markdown links using the format \`[label](url)\`. Do not omit relevant links — the user should be able to click them. If the result has multiple links, list each one.
- If a request requires chaining several tools (e.g. geocode first, then weather), chain them yourself without asking confirmation, and finally deliver a natural-language summary.
- Never return raw JSON to the user. Always translate tool results into natural language.
- When a tool accepts a language parameter (e.g. "lang", "language", "locale", "accept-language"), pass the active conversation language: "{{ACTIVE_LANG}}" (use "es" for Spanish, "en" for English) unless the user explicitly asks for content in another language.
- Do not use emojis. In particular, never end a response with an emoji (e.g. 😊). Reply in plain text.
- Always respond in English unless the user explicitly writes in another language.`,

  es: `Eres un asistente conversacional local.

Puedes conversar normalmente con el usuario. También tienes acceso a servicios externos dinámicos provistos por el backend.

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
- FALLAS DE TOOLS: Si una tool devuelve ok=false, un campo error, o datos vacíos/nulos, DEBES informar claramente al usuario que no pudiste obtener esa información (ej: "No pude obtener [X] — el servicio devolvió un error"). NUNCA inventes, adivines ni completes información cuando una tool ha fallado. No presentes datos inventados como si vinieran del servicio.
- REQUESTS MÚLTIPLES: Si el usuario pide varias cosas distintas (ej: fotos de temas diferentes, más un artículo), descompone el pedido y llama cada tool por separado en secuencia. NO intentes satisfacer todo en una sola llamada. Llama la tool 1, obtén el resultado, llama la tool 2, obtén el resultado, etc., y luego compone la respuesta final.
- RE-EJECUCIÓN DE PEDIDOS: Si el usuario pide "repetir", "volver a ejecutar", "hacer de nuevo", "ejecutar nuevamente" o similar sobre un conjunto de tareas anteriores, DEBES ejecutar TODAS las tareas de ese conjunto llamando cada tool por separado en secuencia — no solo la última. Por ejemplo, si tu respuesta anterior listó 4 acciones (búsqueda de imagen, Wikipedia, precio, etc.), vuelve a ejecutar las 4.
- Si el usuario pide imágenes, fotos, fotografías o cualquier material visual sobre cualquier tema, DEBES llamar a la tool de búsqueda de imágenes (unsplash_search_photos o wikimedia_commons_search). NUNCA inventes ni adivines URLs de imágenes — los IDs de fotos de Unsplash no existen hasta obtenerlos de la tool. NUNCA uses dominios de placeholder como example.com, placeholder.com, via.placeholder.com, ni ninguna URL inventada. Llamá la tool primero y usá las URLs exactas del resultado.
- Después de recibir resultado de una tool, resume la información de forma útil.
- ENLACES: Si el resultado de la tool contiene URLs (artículos, páginas fuente, páginas de imágenes, enlaces de referencia, etc.), inclúyelos en tu respuesta como enlaces Markdown con el formato \`[texto](url)\`. No omitas enlaces relevantes — el usuario debe poder hacer clic en ellos. Si hay varios enlaces, lista cada uno.
- Si una respuesta requiere usar varias tools en cadena (ej: primero geocode, luego clima), encadénalas tú mismo sin pedir confirmación al usuario, y al final entrega un resumen en lenguaje natural.
- Nunca devuelvas JSON crudo al usuario. Siempre traduce el resultado de las tools a una respuesta en lenguaje natural.
- Cuando una tool acepte un parámetro de idioma (por ejemplo "lang", "language", "locale", "accept-language"), pasa el idioma activo de la conversación: "{{ACTIVE_LANG}}" (usa "es" para español, "en" para inglés) salvo que el usuario pida explícitamente contenido en otro idioma.
- No uses emojis en tus respuestas. En particular, nunca termines una respuesta con un emoji (por ejemplo 😊). Responde en texto plano.
- Responde siempre en español a menos que el usuario escriba explícitamente en otro idioma.`,
};

function pickLang(lang?: string | null): "en" | "es" {
  return lang === "es" ? "es" : "en";
}

async function buildSystemPrompt(
  sessionCustom: string | null | undefined,
  language: string | null | undefined,
  cfgPromptEn?: string | null,
  cfgPromptEs?: string | null,
): Promise<string> {
  const lang = pickLang(language);
  const services = await getServicesDescriptionForPrompt();

  // Use DB-stored prompt if set, otherwise fall back to hardcoded template
  const dbPrompt = lang === "es" ? cfgPromptEs : cfgPromptEn;
  const baseTemplate = dbPrompt?.trim() || SYSTEM_PROMPT_TEMPLATES[lang];

  const base = baseTemplate
    .replace("{{SERVICES_LIST}}", services)
    .replace("{{ACTIVE_LANG}}", lang);
  const extraHeader = lang === "es" ? "Instrucciones adicionales" : "Additional instructions";
  if (sessionCustom?.trim()) {
    return `${base}\n\n${extraHeader}:\n${sessionCustom.trim()}`;
  }
  return base;
}

async function loadHistory(sessionId: string): Promise<OllamaMessage[]> {
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .filter((m) => {
      if (!m.metadata) return true;
      try {
        const meta = JSON.parse(m.metadata) as { cancelled?: boolean };
        return !meta.cancelled;
      } catch {
        return true;
      }
    })
    .map((m) => {
      if (m.role === "tool") {
        return { role: "tool", content: m.content, name: m.toolName || undefined };
      }
      // Reconstruct tool_calls from metadata for intermediate assistant messages.
      // These are saved before each tool execution so the history stays valid for Ollama.
      if (m.role === "assistant" && m.metadata) {
        try {
          const meta = JSON.parse(m.metadata) as { _intermediate?: boolean; tool_calls?: OllamaMessage["tool_calls"] };
          if (meta._intermediate && meta.tool_calls) {
            return { role: "assistant" as const, content: m.content, tool_calls: meta.tool_calls };
          }
        } catch { /* ignore malformed metadata */ }
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
  toolCalls: Array<{ name: string; displayName: string; args: any; result: any; durationMs: number; ok: boolean }>;
};

export async function runChatTurn(input: {
  sessionId: string;
  userContent: string;
  inputType?: "text" | "voice";
  userAudioUrl?: string | null;
}): Promise<OrchestrationResult> {
  const { sessionId, userContent, inputType = "text", userAudioUrl = null } = input;

  const t0 = Date.now();
  let llmCalls = 0;
  let llmMs = 0;
  let toolMs = 0;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Sesión no existe");

  // Mark session as actively processing so the frontend can detect it after a page reload.
  await prisma.session.update({ where: { id: sessionId }, data: { isProcessing: true } });

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
      audioUrl: userAudioUrl,
    },
  });
  // Auto-nombrar la sesión con el primer mensaje si todavía tiene el título por defecto
  const DEFAULT_TITLES = ["Nueva sesión", "New session", "Nueva sesion"];
  if (DEFAULT_TITLES.includes(session.title.trim())) {
    // Verificar que este es el primer mensaje (solo el que acabamos de crear)
    const msgCount = await prisma.message.count({ where: { sessionId } });
    if (msgCount <= 1) {
      const rawTitle = userContent.trim().replace(/\s+/g, " ");
      const autoTitle = rawTitle.length > 48 ? rawTitle.slice(0, 46).trimEnd() + "…" : rawTitle;
      await prisma.session.update({ where: { id: sessionId }, data: { title: autoTitle, updatedAt: new Date() } });
    } else {
      await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    }
  } else {
    await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
  }

  // 2. Construir mensajes
  const systemPrompt = await buildSystemPrompt(session.systemPrompt, cfg.language, cfg.systemPromptEn, cfg.systemPromptEs);
  const history = await loadHistory(sessionId);
  const messages: OllamaMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  const tools = await getToolDefinitionsForOllama();

  const MAX_TOOL_ITERATIONS = 10;
  const toolCalls: OrchestrationResult["toolCalls"] = [];
  type LlmTraceEntry = { step: number; label: string; inputMessages: OllamaMessage[]; response: unknown };
  const llmTrace: LlmTraceEntry[] = [];
  let tLlm = Date.now();
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
  llmMs += Date.now() - tLlm;
  llmCalls++;
  llmTrace.push({ step: llmCalls, label: "initial", inputMessages: messages, response: response.message });

  // 4. Loop multi-step tool calling
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    // Procesamos TODOS los tool_calls que el modelo devolvió en esta respuesta
    // (llama3.1 puede devolver varios a la vez). Si no hay ninguno, terminamos.
    const batchCalls = response.message?.tool_calls ?? [];
    if (batchCalls.length === 0) break;

    // Check if the user requested cancellation (e.g. clicked Stop while the backend was mid-loop).
    const sessionState = await prisma.session.findUnique({ where: { id: sessionId }, select: { cancelRequested: true } });
    if (sessionState?.cancelRequested) {
      await prisma.session.update({ where: { id: sessionId }, data: { cancelRequested: false } });
      break;
    }

    // Persist the intermediate assistant message (with tool_calls) BEFORE executing tools.
    // Without this, subsequent turns reconstruct history as: user → tool_result → assistant,
    // which is invalid — Ollama requires: user → assistant(tool_calls) → tool_result → assistant.
    await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: response.message?.content ?? "",
        inputType: "none",
        outputType: "none",
        metadata: JSON.stringify({ _intermediate: true, tool_calls: batchCalls }),
      },
    });

    // Phase 1: Validate all tool calls sequentially (cheap, no IO).
    // Collect valid ones for parallel execution; return early on hard errors.
    type ReadyCall = { tool: ToolWithParsed; args: Record<string, unknown> };
    const readyCalls: ReadyCall[] = [];

    for (const toolCall of batchCalls) {
      const toolName = toolCall.function.name;
      const rawArgs =
        typeof toolCall.function.arguments === "string"
          ? safeJson(toolCall.function.arguments)
          : toolCall.function.arguments || {};

      const tool = await getToolByName(toolName);

      if (!tool) {
        const errMsg =
          cfg.language === "es"
            ? `La AI intentó usar una tool inexistente: ${toolName}.`
            : `The AI tried to use a non-existent tool: ${toolName}.`;
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
        const errMsg =
          cfg.language === "es"
            ? `La tool "${toolName}" está deshabilitada.`
            : `The tool "${toolName}" is disabled.`;
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

      const argsWithDefaults = applyDefaults(tool, rawArgs as Record<string, unknown>);
      const validation = validateToolArguments(tool, argsWithDefaults);

      if (!validation.ok && validation.missingRequired.length > 0) {
        const question = buildClarifyingQuestion(tool, validation.missingRequired, cfg.language);
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
        // Args inválidos (enum incorrecto, etc.) → devolvemos el error como tool_result
        // para que el LLM se autocorrija en la siguiente iteración.
        const errorPayload = {
          ok: false,
          error: "invalid_arguments",
          message:
            cfg.language === "es"
              ? "Los argumentos no son válidos. Revisá el schema y reintentá. Para parámetros opcionales que no aplican, NO los incluyas (omitilos del JSON) en vez de mandar string vacío o null."
              : "Arguments are invalid. Review the schema and retry. For optional parameters that don't apply, OMIT them from the JSON instead of sending empty string or null.",
          details: validation.errors,
          receivedArgs: argsWithDefaults,
        };
        await prisma.message.create({
          data: {
            sessionId,
            role: "tool",
            toolName: tool.name,
            content: JSON.stringify(errorPayload),
            inputType: "tool",
            outputType: "tool_result",
            metadata: JSON.stringify({ args: argsWithDefaults, validationError: true, durationMs: 0 }),
          },
        });
        toolCalls.push({
          name: tool.name,
          displayName: tool.displayName,
          args: argsWithDefaults,
          result: errorPayload,
          durationMs: 0,
          ok: false,
        });
        // Soft error: don't stop the batch, let LLM self-correct
        continue;
      }

      readyCalls.push({ tool, args: validation.value });
    }

    // Phase 2: Execute all valid tool calls in parallel
    if (readyCalls.length > 0) {
      const execResults = await Promise.all(
        readyCalls.map(async ({ tool, args }) => {
          const tTool = Date.now();
          const execResult = await executeHttpTool(tool, args);
          return { tool, args, execResult, durationMs: Date.now() - tTool };
        })
      );

      // Persist results and accumulate stats sequentially (order matters for history)
      for (const { tool, args, execResult, durationMs } of execResults) {
        toolMs += durationMs;
        const resultObj: Record<string, unknown> = {
          ok: execResult.ok,
          status: execResult.status,
          data: execResult.data,
          error: execResult.error,
        };
        if (!execResult.ok) {
          resultObj.__directive__ =
            cfg.language === "es"
              ? `IMPORTANTE: Esta tool FALLÓ (ok=false). No tienes datos de "${tool.displayName}". DEBES informar al usuario que no pudiste obtener esa información. NUNCA inventes ni supongas los datos.`
              : `IMPORTANT: This tool FAILED (ok=false). You have no data from "${tool.displayName}". You MUST tell the user you could not retrieve this information. NEVER fabricate or guess the data.`;
        }
        const resultContent = JSON.stringify(resultObj);

        await prisma.message.create({
          data: {
            sessionId,
            role: "tool",
            toolName: tool.name,
            content: resultContent,
            inputType: "tool",
            outputType: "tool_result",
            metadata: JSON.stringify({ args, meta: execResult.meta, durationMs }),
          },
        });

        toolCalls.push({
          name: tool.name,
          displayName: tool.displayName,
          args,
          result: execResult,
          durationMs,
          ok: execResult.ok,
        });
      }
    }

    // Tras procesar todos los tool_calls del batch, re-consultamos al modelo.
    // Inyectamos un hint de continuación (sin persistir) para que siga llamando
    // tools si el pedido original tenía más temas pendientes.
    const updatedHistory = await loadHistory(sessionId);
    const isFinalIter = iter === MAX_TOOL_ITERATIONS - 1;
    const continueHint: OllamaMessage | null = isFinalIter
      ? null
      : {
          role: "system",
          content:
            cfg.language === "es"
              ? "Tools ejecutadas. Si el pedido original requiere más datos, llamá la siguiente tool ahora. IMPORTANTE: si alguna tool devolvió ok=false o un error, DEBES informar ese fallo honestamente — nunca inventes los datos que debería haber devuelto. Solo respondé en lenguaje natural cuando tengas todos los datos necesarios."
              : "Tools executed. If the original request requires more data, call the next tool now. IMPORTANT: if any tool returned ok=false or an error, you MUST report that failure honestly — never invent the data it should have returned. Only reply in natural language when you have all the data needed.",
        };
    const messagesNext: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...updatedHistory,
      ...(continueHint ? [continueHint] : []),
    ];

    tLlm = Date.now();
    response = await chatWithOllama(
      {
        model,
        messages: messagesNext,
        tools: tools.length > 0 ? tools : undefined,
        temperature: cfg.temperature,
        topP: cfg.topP,
      },
      cfg.ollamaBaseUrl
    );
    llmMs += Date.now() - tLlm;
    llmCalls++;
    llmTrace.push({ step: llmCalls, label: `tool-loop-iter-${iter + 1}`, inputMessages: messagesNext, response: response.message });
  }

  // Si después del loop el modelo sigue queriendo llamar tools, forzamos respuesta sin tools
  if (response.message?.tool_calls?.[0]) {
    const updatedHistory = await loadHistory(sessionId);
    tLlm = Date.now();
    response = await chatWithOllama(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...updatedHistory,
          {
            role: "system",
            content:
              cfg.language === "es"
                ? "Ya tienes suficiente información de las tools ejecutadas. Resume la respuesta final al usuario en lenguaje natural, sin llamar más tools y sin devolver JSON crudo."
                : "You already have enough information from the executed tools. Summarize the final response for the user in natural language, without calling more tools and without returning raw JSON.",
          },
        ],
        // sin tools para forzar respuesta de texto
        temperature: cfg.temperature,
        topP: cfg.topP,
      },
      cfg.ollamaBaseUrl
    );
    llmMs += Date.now() - tLlm;
    llmCalls++;
  }

  // Detección de alucinaciones de imágenes: si el LLM devolvió texto con links
  // a páginas de Unsplash/Wikipedia (no URLs directas de imagen) o dominios
  // placeholder (example.com, via.placeholder.com, etc.) y no llamó tool,
  // lo forzamos a rellamar la tool de imágenes.
  const rawText = response.message?.content || "";
  const hasUnsplashPageLinks = /https?:\/\/unsplash\.com\/photos\//i.test(rawText);
  const hasFakePlaceholders = /https?:\/\/(example\.com|placeholder\.com|via\.placeholder\.com|placehold\.it|dummyimage\.com|picsum\.photos\/(?:seed\/\w+\/\d+\/\d+))\//i.test(rawText);
  if ((hasUnsplashPageLinks || hasFakePlaceholders) && toolCalls.length === 0) {
    const correction =
      cfg.language === "es"
        ? "CORRECCIÓN: Detecté que usaste URLs inventadas o placeholders (example.com, unsplash.com/photos/, etc.) en lugar de imágenes reales. Esas URLs no funcionan. DEBES llamar las tools de búsqueda de imágenes (unsplash_search_photos o wikimedia_commons_search) para cada tema pedido y usar las URLs exactas que devuelvan. Para pedidos con múltiples temas, llamá cada tool por separado. No respondas con texto hasta tener los resultados reales de las tools."
        : "CORRECTION: You used fake or placeholder URLs (example.com, unsplash.com/photos/, etc.) instead of real images. Those URLs do not work. You MUST call the image search tools (unsplash_search_photos or wikimedia_commons_search) for each requested topic and use the exact URLs they return. For multi-topic requests, call each tool separately. Do not reply with text until you have real tool results.";
    const updatedHistory = await loadHistory(sessionId);
    tLlm = Date.now();
    response = await chatWithOllama(
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...updatedHistory,
          { role: "system", content: correction },
        ],
        tools: tools.length > 0 ? tools : undefined,
        temperature: cfg.temperature,
        topP: cfg.topP,
      },
      cfg.ollamaBaseUrl
    );
    llmMs += Date.now() - tLlm;
    llmCalls++;
    // Si ahora llamó la tool, continuamos el loop
    if (response.message?.tool_calls?.[0]) {
      // Simulamos una iteración más del loop principal
      // re-entramos procesando este tool_call
      const tc = response.message.tool_calls[0];
      const toolName2 = tc.function.name;
      const rawArgs2 = typeof tc.function.arguments === "string"
        ? safeJson(tc.function.arguments)
        : tc.function.arguments || {};
      const tool2 = await getToolByName(toolName2);
      if (tool2?.enabled) {
        const args2 = applyDefaults(tool2, rawArgs2 as Record<string, unknown>);
        const val2 = validateToolArguments(tool2, args2);
        if (val2.ok) {
          const tTool2 = Date.now();
          const exec2 = await executeHttpTool(tool2, val2.value);
          const dur2 = Date.now() - tTool2;
          toolMs += dur2;
          await prisma.message.create({
            data: {
              sessionId, role: "tool", toolName: tool2.name,
              content: JSON.stringify({ ok: exec2.ok, status: exec2.status, data: exec2.data, error: exec2.error }),
              inputType: "tool", outputType: "tool_result",
              metadata: JSON.stringify({ args: val2.value, meta: exec2.meta, durationMs: dur2 }),
            },
          });
          toolCalls.push({ name: tool2.name, displayName: tool2.displayName, args: val2.value, result: exec2, durationMs: dur2, ok: exec2.ok });
          const h3 = await loadHistory(sessionId);
          tLlm = Date.now();
          response = await chatWithOllama(
            { model, messages: [{ role: "system", content: systemPrompt }, ...h3], tools: tools.length > 0 ? tools : undefined, temperature: cfg.temperature, topP: cfg.topP },
            cfg.ollamaBaseUrl
          );
          llmMs += Date.now() - tLlm;
          llmCalls++;
        }
      }
    }
  }

  const finalText = stripTrailingEmojis(response.message?.content || "");
  const totalMs = Date.now() - t0;
  const assistant = await prisma.message.create({
    data: {
      sessionId,
      role: "assistant",
      content: finalText,
      outputType: "text",
      llmTrace: JSON.stringify(llmTrace),
      metadata: JSON.stringify({
        timing: {
          totalMs,
          llmMs,
          llmCalls,
          toolMs,
          toolCalls: toolCalls.length,
          model,
        },
        tools: toolCalls.map((tc) => ({
          name: tc.name,
          displayName: tc.displayName,
          ok: tc.ok,
          durationMs: tc.durationMs,
          status: tc.result?.status,
          error: tc.ok ? undefined : tc.result?.error,
          args: tc.args,
        })),
      }),
    },
  });

  logger.info(
    `[turn] model=${model} total=${totalMs}ms llm=${llmMs}ms (x${llmCalls}) tools=${toolMs}ms (x${toolCalls.length}) input=${userContent.length}ch out=${finalText.length}ch`
  );

  // Reset cancellation flag in case it was set after the loop exited normally.
  await prisma.session.update({ where: { id: sessionId }, data: { cancelRequested: false, isProcessing: false } });

  return { finalText, assistantMessageId: assistant.id, toolCalls };
}

/**
 * Quita emojis y espacios al final del texto.
 * Cubre símbolos pictográficos, emoticonos, dingbats y variation selectors.
 */
function stripTrailingEmojis(text: string): string {
  if (!text) return text;
  // Quita pictogramas, ZWJ, variation selectors, keycaps y espacios al final.
  return text.replaceAll(
    /(?:\p{Extended_Pictographic}|\u200D|\uFE0F|\u20E3|\s)+$/gu,
    ""
  );
}

function buildClarifyingQuestion(
  tool: ToolWithParsed,
  missing: string[],
  language?: string | null
): string {
  const lang = pickLang(language);
  const questions = tool.parameterPolicyObj.questions || {};
  const fallback = (p: string) =>
    lang === "es" ? `¿Podrías indicarme "${p}"?` : `Could you tell me "${p}"?`;
  const parts = missing.map((p) => questions[p] || fallback(p));
  return parts.join(" ");
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

// ─── Streaming variant ────────────────────────────────────────────────────────

export type StreamingCallbacks = {
  onToolStart?: (data: { name: string; displayName: string; args: unknown }) => void;
  onToolEnd?: (data: { name: string; displayName: string; ok: boolean; durationMs: number }) => void;
  onToken: (token: string) => void;
  onDone: (result: OrchestrationResult) => void;
};

/**
 * Like runChatTurn but streams the final LLM response token-by-token via
 * `callbacks.onToken`. Tool calls are buffered (no streaming) for simplicity.
 */
export async function runChatTurnStreaming(input: {
  sessionId: string;
  userContent: string;
  inputType?: "text" | "voice";
  userAudioUrl?: string | null;
  callbacks: StreamingCallbacks;
}): Promise<void> {
  const { sessionId, userContent, inputType = "text", userAudioUrl = null, callbacks } = input;
  const { onToolStart, onToolEnd, onToken, onDone } = callbacks;

  const t0 = Date.now();
  let llmCalls = 0;
  let llmMs = 0;
  let toolMs = 0;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Sesión no existe");

  // Mark session as actively processing.
  await prisma.session.update({ where: { id: sessionId }, data: { isProcessing: true } });

  const cfg = await getConfig();
  const model = session.model || cfg.defaultModel || env.OLLAMA_DEFAULT_MODEL;

  await prisma.message.create({
    data: { sessionId, role: "user", content: userContent, inputType, outputType: "none", audioUrl: userAudioUrl },
  });

  // Auto-title
  const DEFAULT_TITLES = ["Nueva sesión", "New session", "Nueva sesion"];
  if (DEFAULT_TITLES.includes(session.title.trim())) {
    const msgCount = await prisma.message.count({ where: { sessionId } });
    if (msgCount <= 1) {
      const raw = userContent.trim().replaceAll(/\s+/g, " ");
      await prisma.session.update({ where: { id: sessionId }, data: { title: raw.length > 48 ? raw.slice(0, 46).trimEnd() + "…" : raw, updatedAt: new Date() } });
    } else {
      await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    }
  } else {
    await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
  }

  const systemPrompt = await buildSystemPrompt(session.systemPrompt, cfg.language, cfg.systemPromptEn, cfg.systemPromptEs);
  const history = await loadHistory(sessionId);
  const tools = await getToolDefinitionsForOllama();
  const toolCalls: OrchestrationResult["toolCalls"] = [];
  type LlmTraceEntry = { step: number; label: string; inputMessages: OllamaMessage[]; response: unknown };
  const llmTrace: LlmTraceEntry[] = [];

  let messages: OllamaMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  // Tool calling loop (buffered — no streaming during tool calls)
  const MAX_TOOL_ITERATIONS = 10;
  let tLlm = Date.now();
  let response = await chatWithOllama({ model, messages, tools: tools.length > 0 ? tools : undefined, temperature: cfg.temperature, topP: cfg.topP }, cfg.ollamaBaseUrl);
  llmMs += Date.now() - tLlm;
  llmCalls++;
  llmTrace.push({ step: llmCalls, label: "initial", inputMessages: messages, response: response.message });

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const batchCalls = response.message?.tool_calls ?? [];
    if (batchCalls.length === 0) break;

    // Check cancellation flag before executing tool calls.
    const sessionState2 = await prisma.session.findUnique({ where: { id: sessionId }, select: { cancelRequested: true } });
    if (sessionState2?.cancelRequested) {
      await prisma.session.update({ where: { id: sessionId }, data: { cancelRequested: false } });
      break;
    }

    // Persist intermediate assistant message so history stays valid for Ollama protocol.
    await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: response.message?.content ?? "",
        inputType: "none",
        outputType: "none",
        metadata: JSON.stringify({ _intermediate: true, tool_calls: batchCalls }),
      },
    });

    type ReadyCall = { tool: ToolWithParsed; args: Record<string, unknown> };
    const readyCalls: ReadyCall[] = [];

    for (const toolCall of batchCalls) {
      const toolName = toolCall.function.name;
      const rawArgs = typeof toolCall.function.arguments === "string" ? safeJson(toolCall.function.arguments) : toolCall.function.arguments || {};
      const tool = await getToolByName(toolName);
      if (!tool?.enabled) continue;
      const argsWithDefaults = applyDefaults(tool, rawArgs as Record<string, unknown>);
      const validation = validateToolArguments(tool, argsWithDefaults);
      if (!validation.ok) continue;
      readyCalls.push({ tool, args: validation.value });
    }

    if (readyCalls.length === 0) break;

    for (const { tool, args } of readyCalls) {
      onToolStart?.({ name: tool.name, displayName: tool.displayName, args });
    }

    const execResults = await Promise.all(
      readyCalls.map(async ({ tool, args }) => {
        const tTool = Date.now();
        const execResult = await executeHttpTool(tool, args);
        return { tool, args, execResult, durationMs: Date.now() - tTool };
      })
    );

    for (const { tool, args, execResult, durationMs } of execResults) {
      toolMs += durationMs;
      onToolEnd?.({ name: tool.name, displayName: tool.displayName, ok: execResult.ok, durationMs });
      const streamResultObj: Record<string, unknown> = {
        ok: execResult.ok,
        status: execResult.status,
        data: execResult.data,
        error: execResult.error,
      };
      if (!execResult.ok) {
        streamResultObj.__directive__ =
          cfg.language === "es"
            ? `IMPORTANTE: Esta tool FALLÓ (ok=false). No tienes datos de "${tool.displayName}". DEBES informar al usuario que no pudiste obtener esa información. NUNCA inventes ni supongas los datos.`
            : `IMPORTANT: This tool FAILED (ok=false). You have no data from "${tool.displayName}". You MUST tell the user you could not retrieve this information. NEVER fabricate or guess the data.`;
      }
      await prisma.message.create({
        data: {
          sessionId, role: "tool", toolName: tool.name,
          content: JSON.stringify(streamResultObj),
          inputType: "tool", outputType: "tool_result",
          metadata: JSON.stringify({ args, meta: execResult.meta, durationMs }),
        },
      });
      toolCalls.push({ name: tool.name, displayName: tool.displayName, args, result: execResult, durationMs, ok: execResult.ok });
    }

    const updatedHistory = await loadHistory(sessionId);
    messages = [{ role: "system", content: systemPrompt }, ...updatedHistory];
    tLlm = Date.now();
    response = await chatWithOllama({ model, messages, tools: tools.length > 0 ? tools : undefined, temperature: cfg.temperature, topP: cfg.topP }, cfg.ollamaBaseUrl);
    llmMs += Date.now() - tLlm;
    llmCalls++;
    llmTrace.push({ step: llmCalls, label: `tool-loop-iter-${iter + 1}`, inputMessages: messages, response: response.message });

    logger.debug(
      `[streaming loop] iter=${toolCalls.length} tools toolResults in history=${updatedHistory.filter(m => m.role === "tool").length}`,
      updatedHistory.filter(m => m.role === "tool").map(m => ({ name: m.name, contentLen: m.content.length }))
    );
  }

  // If the loop already produced a text response (tool calls resolved), stream
  // that content directly — no extra LLM call needed.
  // Only call streamChatFromOllama when there were no tools at all (pure text turn).
  let finalText = "";
  const textFromLoop = response.message?.content ?? "";

  // Build no-hallucination hint for any failed tools
  const failedTools = toolCalls.filter((tc) => !tc.ok);
  const noHallucinateHint: OllamaMessage | null =
    failedTools.length > 0
      ? {
          role: "system",
          content:
            cfg.language === "es"
              ? `RECORDATORIO CRÍTICO: Las siguientes tools FALLARON y no tienen datos reales: ${failedTools.map((t) => t.displayName).join(", ")}. DEBES informar al usuario que no pudiste obtener esa información. NUNCA inventes ni supongas los datos que deberían haber devuelto esas tools.`
              : `CRITICAL REMINDER: The following tools FAILED and have no real data: ${failedTools.map((t) => t.displayName).join(", ")}. You MUST tell the user you could not retrieve that information. NEVER fabricate or guess what those failed tools should have returned.`,
        }
      : null;

  if (toolCalls.length > 0 && textFromLoop) {
    // The loop already has the final answer — emit it as tokens directly
    logger.info(`[streaming] using loop response directly (${toolCalls.length} tools executed, ${textFromLoop.length} chars)`);
    onToken(textFromLoop);
    finalText = textFromLoop;
  } else {
    // Pure text turn (no tools) or loop ended without text — stream from Ollama
    const finalMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(await loadHistory(sessionId)),
      ...(noHallucinateHint ? [noHallucinateHint] : []),
    ];
    logger.debug(
      `[streaming] final LLM call — history msgs=${finalMessages.length} tool_results=${finalMessages.filter(m => m.role === "tool").length}`
    );
    tLlm = Date.now();
    for await (const chunk of streamChatFromOllama(
      { model, messages: finalMessages, temperature: cfg.temperature, topP: cfg.topP },
      cfg.ollamaBaseUrl
    )) {
      if (chunk.token) onToken(chunk.token);
      if (chunk.done) finalText = chunk.fullResponse.message?.content ?? "";
    }
    llmMs += Date.now() - tLlm;
    llmCalls++;
    llmTrace.push({ step: llmCalls, label: "final-stream", inputMessages: finalMessages, response: { content: finalText } });
  }

  finalText = stripTrailingEmojis(finalText || "");
  const totalMs = Date.now() - t0;

  const assistant = await prisma.message.create({
    data: {
      sessionId, role: "assistant", content: finalText, outputType: "text",
      llmTrace: JSON.stringify(llmTrace),
      metadata: JSON.stringify({
        timing: { totalMs, llmMs, llmCalls, toolMs, toolCalls: toolCalls.length, model },
        tools: toolCalls.map((tc) => ({ name: tc.name, displayName: tc.displayName, ok: tc.ok, durationMs: tc.durationMs })),
      }),
    },
  });

  // Reset cancellation flag.
  await prisma.session.update({ where: { id: sessionId }, data: { cancelRequested: false, isProcessing: false } });

  onDone({ finalText, assistantMessageId: assistant.id, toolCalls });
}

