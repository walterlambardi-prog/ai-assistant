import { renderObject, renderTemplate } from "../utils/template";
import { assertSafeUrl, redactHeaders } from "../utils/security";
import type { ToolWithParsed } from "./dynamic-tools.service";
import { logger } from "../utils/logger";

// Apply a responseMapping to simplify large API payloads before sending to LLM.
// Mapping is stored as JSON in the tool's responseMapping field.
// Supported directives:
//   { "type": "unsplash_photos" }  — extract photo array into slim objects
//   { "type": "jmespath", "expr": "..." }  — reserved for future use
function applyResponseMapping(tool: ToolWithParsed, data: unknown): unknown {
  const mapping = tool.responseMappingObj;
  if (!mapping || typeof mapping !== "object" || !("type" in mapping)) return data;

  const type = (mapping as Record<string, unknown>).type;

  if (type === "unsplash_photos") {
    // Unsplash /search/photos → {total, results:[{id, description, alt_description, urls, user, links}]}
    const d = data as any;
    const results: any[] = Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
    return results.map((r: any) => ({
      id: r.id,
      description: r.alt_description || r.description || "",
      image_url: r.urls?.regular || r.urls?.small || "",
      thumb_url: r.urls?.thumb || "",
      page_url: r.links?.html || "",
      author: r.user?.name || "",
    }));
  }

  if (type === "unsplash_random") {
    // Unsplash /photos/random → single photo object
    const r = data as any;
    return {
      id: r.id,
      description: r.alt_description || r.description || "",
      image_url: r.urls?.regular || r.urls?.small || "",
      thumb_url: r.urls?.thumb || "",
      page_url: r.links?.html || "",
      author: r.user?.name || "",
    };
  }

  return data;
}

export type ToolExecutionResult = {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  meta: {
    url: string;
    method: string;
    headers: Record<string, string>;
    durationMs: number;
    truncated?: boolean;
    bytes?: number;
  };
};

export async function executeHttpTool(
  tool: ToolWithParsed,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  // Contexto de templating: args (de Ollama) + secrets de la tool.
  // Los secrets sobreescriben args con el mismo nombre por seguridad,
  // y `renderTemplate` también puede leer process.env como fallback.
  const ctx: Record<string, unknown> = { ...args, ...(tool.secretsObj || {}) };

  // Render URL with template
  const renderedUrl = renderTemplate(tool.url, ctx);

  // Build query string
  const renderedQuery = renderObject(tool.queryParamsObj, ctx) as Record<string, string>;
  const urlObj = await assertSafeUrl(renderedUrl, tool.allowedHostsArr);
  for (const [k, v] of Object.entries(renderedQuery)) {
    if (v !== undefined && v !== null && v !== "") urlObj.searchParams.set(k, String(v));
  }

  const method = (tool.method || "GET").toUpperCase();
  const headers: Record<string, string> = renderObject(tool.headersObj, ctx) as Record<string, string>;

  let body: string | undefined;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const renderedBody = renderObject(tool.bodyTemplateObj, ctx);
    if (renderedBody && Object.keys(renderedBody as object).length > 0) {
      body = JSON.stringify(renderedBody);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const controller = new AbortController();
  const timeoutMs = tool.timeoutMs || 10000;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = Date.now();
  const finalUrl = urlObj.toString();

  try {
    logger.debug("Executing HTTP tool", { name: tool.name, method, url: finalUrl });
    const res = await fetch(finalUrl, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const maxBytes = (tool.maxResponseKb || 256) * 1024;
    const reader = res.body?.getReader();
    let received = 0;
    let truncated = false;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            truncated = true;
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            break;
          }
          chunks.push(value);
        }
      }
    }

    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const text = buf.toString("utf-8");
    let data: unknown = text;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch {
        /* keep as text */
      }
    }

    const meta = {
      url: finalUrl,
      method,
      headers: redactHeaders(headers),
      durationMs: Date.now() - startedAt,
      truncated,
      bytes: received,
    };

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: `HTTP ${res.status}`,
        meta,
      };
    }

    return { ok: true, status: res.status, data: applyResponseMapping(tool, data), meta };
  } catch (err: any) {
    const meta = {
      url: finalUrl,
      method,
      headers: redactHeaders(headers),
      durationMs: Date.now() - startedAt,
    };
    const message =
      err?.name === "AbortError" ? `Timeout (${timeoutMs}ms)` : err?.message || "Tool execution failed";
    return { ok: false, error: message, meta };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
