import { renderObject, renderTemplate } from "../utils/template";
import { assertSafeUrl, redactHeaders } from "../utils/security";
import type { ToolWithParsed } from "./dynamic-tools.service";
import { logger } from "../utils/logger";

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
  const ctx: Record<string, unknown> = { ...args };

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

    return { ok: true, status: res.status, data, meta };
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
