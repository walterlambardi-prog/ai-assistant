import { prisma } from "../db/prisma";
import type { ToolDefinition } from "../types/tools";
import { validateAgainstSchema, ValidationResult } from "../utils/validateJsonSchema";

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type ToolWithParsed = Awaited<ReturnType<typeof getEnabledTools>>[number];

export async function getEnabledTools() {
  const rows = await prisma.tool.findMany({ where: { enabled: true } });
  return rows.map((t) => ({
    ...t,
    headersObj: safeParse<Record<string, string>>(t.headers, {}),
    queryParamsObj: safeParse<Record<string, string>>(t.queryParams, {}),
    bodyTemplateObj: safeParse<Record<string, unknown>>(t.bodyTemplate, {}),
    parametersObj: safeParse<Record<string, unknown>>(t.parameters, {
      type: "object",
      properties: {},
    }),
    parameterPolicyObj: safeParse<{
      defaults?: Record<string, unknown>;
      askIfMissing?: Record<string, boolean>;
      questions?: Record<string, string>;
    }>(t.parameterPolicy, {}),
    responseMappingObj: safeParse<Record<string, unknown>>(t.responseMapping, {}),
    allowedHostsArr: safeParse<string[]>(t.allowedHosts, []),
    secretsObj: safeParse<Record<string, string>>(t.secrets, {}),
  }));
}

export async function getToolByName(name: string) {
  const t = await prisma.tool.findUnique({ where: { name } });
  if (!t) return null;
  const tools = await getEnabledTools();
  return tools.find((x) => x.name === name) || {
    ...t,
    headersObj: safeParse<Record<string, string>>(t.headers, {}),
    queryParamsObj: safeParse<Record<string, string>>(t.queryParams, {}),
    bodyTemplateObj: safeParse<Record<string, unknown>>(t.bodyTemplate, {}),
    parametersObj: safeParse<Record<string, unknown>>(t.parameters, {
      type: "object",
      properties: {},
    }),
    parameterPolicyObj: safeParse<any>(t.parameterPolicy, {}),
    responseMappingObj: safeParse<Record<string, unknown>>(t.responseMapping, {}),
    allowedHostsArr: safeParse<string[]>(t.allowedHosts, []),
    secretsObj: safeParse<Record<string, string>>(t.secrets, {}),
  };
}

export async function getToolDefinitionsForOllama(): Promise<ToolDefinition[]> {
  const tools = await getEnabledTools();
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description:
        (t.description || "") +
        (t.usageGuidance ? `\n\nCuándo usarla: ${t.usageGuidance}` : ""),
      parameters: t.parametersObj,
    },
  }));
}

export async function getServicesDescriptionForPrompt(): Promise<string> {
  const tools = await getEnabledTools();
  if (tools.length === 0) {
    return "(No hay servicios externos configurados actualmente)";
  }
  return tools
    .map((t) => `- ${t.displayName}: ${t.description}${t.usageGuidance ? ` (${t.usageGuidance})` : ""}`)
    .join("\n");
}

export function applyDefaults(tool: ToolWithParsed, args: Record<string, unknown>) {
  const defaults = tool.parameterPolicyObj.defaults || {};
  // Sanitize incoming args: drop null/undefined and empty strings so that
  // optional parameters left blank by the LLM don't trigger schema errors
  // and don't override defaults. We keep 0 and false on purpose.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args || {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    cleaned[k] = v;
  }
  return { ...defaults, ...cleaned };
}

export function validateToolArguments(
  tool: ToolWithParsed,
  args: Record<string, unknown>
): ValidationResult {
  return validateAgainstSchema(`tool:${tool.id}`, tool.parametersObj, args);
}
