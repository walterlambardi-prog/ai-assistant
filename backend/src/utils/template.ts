/**
 * Renderiza templates {{var}} usando un contexto y env vars.
 * No permite ejecución de código (no eval).
 */
export function renderTemplate(input: string, context: Record<string, unknown>): string {
  return input.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_match, key) => {
    if (key in context && context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    if (process.env[key] !== undefined) {
      return String(process.env[key]);
    }
    return "";
  });
}

export function renderObject<T>(obj: T, context: Record<string, unknown>): T {
  if (typeof obj === "string") {
    return renderTemplate(obj, context) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => renderObject(v, context)) as unknown as T;
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = renderObject(v as unknown, context);
    }
    return out as T;
  }
  return obj;
}
