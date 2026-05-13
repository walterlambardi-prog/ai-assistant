import { renderObject, renderTemplate } from "../utils/template";
import { assertSafeUrl, redactHeaders } from "../utils/security";
import { getToolByName, type ToolWithParsed } from "./dynamic-tools.service";
import { logger } from "../utils/logger";

// ─── Declarative response mapping engine ──────────────────────────────────────
//
// Mappings are stored as JSON in the tool's `responseMapping` field and applied
// to the API response before forwarding it to the LLM. The goal is to keep new
// integrations purely declarative — no code changes per service.
//
// Supported directives:
//
//   { "type": "object_map", "fields": { dst: "path.to.src || fallback", ... } }
//     Transforms a single object. Each value is a path expression (see below).
//
//   { "type": "array_map", "path": "results", "limit": 10,
//     "fields": { dst: "path", ... } }
//     Transforms an array. `path` (optional) selects the array from the root;
//     if omitted, the root itself must be an array. `limit` (optional) truncates.
//
//   { "type": "pick", "fields": ["a", "b.c"], "limit": { "objectIDs": 10 } }
//     Picks a small set of fields from the root. `limit` truncates arrays at
//     the given keys.
//
//   { "type": "pick", "fields": ["a"], "limit": {"a": 3},
//     "then": { "tool": "other_tool", "forEach": "a", "as": "paramName", "into": "results" } }
//     After picking, calls `other_tool` for each element of field `a`, and merges the
//     resolved objects into the `results` key. Enables automatic chaining (e.g. search →
//     detail) without any LLM involvement.
//
// Path expression syntax:
//   - dot-paths:        "a.b.c"
//   - array indices:    "a.0.url"  or  "a[0].url"
//   - boolean falsy fallback chain:  "primaryImageSmall || primaryImage"

type Mapping = Record<string, unknown>;
type ToolExecutor = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

// Resolve a single path segment chain like "a.b.0.c" against an object.
function resolvePath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

// Resolve a path expression with optional fallbacks ("a || b || c").
// Returns the first non-empty value (excludes "", null, undefined, NaN).
function resolveExpr(obj: unknown, expr: string): unknown {
  const alts = expr.split("||").map((s) => s.trim()).filter(Boolean);
  for (const alt of alts) {
    const v = resolvePath(obj, alt);
    if (v !== undefined && v !== null && v !== "" && !(typeof v === "number" && Number.isNaN(v))) {
      return v;
    }
  }
  return "";
}

function mapFields(obj: unknown, fields: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [dst, expr] of Object.entries(fields)) {
    out[dst] = resolveExpr(obj, expr);
  }
  return out;
}

async function applyMapping(mapping: Mapping, data: unknown, executor?: ToolExecutor): Promise<unknown> {
  const type = mapping.type as string | undefined;
  if (!type) return data;

  let result: unknown;

  if (type === "object_map") {
    const fields = (mapping.fields as Record<string, string>) || {};
    result = mapFields(data, fields);
  } else if (type === "array_map") {
    const path = (mapping.path as string) || "";
    const limit = typeof mapping.limit === "number" ? mapping.limit : undefined;
    const fields = (mapping.fields as Record<string, string>) || {};
    const raw = path ? resolvePath(data, path) : data;
    const arr: unknown[] = Array.isArray(raw) ? raw : [];
    const sliced = typeof limit === "number" ? arr.slice(0, limit) : arr;
    result = sliced.map((item) => mapFields(item, fields));
  } else if (type === "pick") {
    const fields = (mapping.fields as string[]) || [];
    const limits = (mapping.limit as Record<string, number>) || {};
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      let v = resolvePath(data, f);
      if (limits[f] && Array.isArray(v)) v = v.slice(0, limits[f]);
      out[f] = v;
    }
    result = out;
  } else {
    return data;
  }

  // then directive: auto-chain into another tool for each element of a field
  const thenDir = mapping.then as { tool: string; forEach: string; as: string; into: string } | undefined;
  if (thenDir && executor && result !== null && typeof result === "object" && !Array.isArray(result)) {
    const ids = (result as Record<string, unknown>)[thenDir.forEach];
    if (Array.isArray(ids) && ids.length > 0) {
      logger.debug(`[responseMapping.then] chaining ${ids.length}x ${thenDir.tool}`);
      const resolved = await Promise.all(
        ids.map((id) => executor(thenDir.tool, { [thenDir.as]: id }))
      );
      result = { ...(result as Record<string, unknown>), [thenDir.into]: resolved };
    }
  }

  return result;
}

async function applyResponseMapping(tool: ToolWithParsed, data: unknown): Promise<unknown> {
  const mapping = tool.responseMappingObj;
  if (!mapping || typeof mapping !== "object" || !("type" in mapping)) return data;
  const executor: ToolExecutor = async (toolName, args) => {
    const chainedTool = await getToolByName(toolName);
    if (!chainedTool?.enabled) return null;
    const res = await executeHttpTool(chainedTool, args);
    return res.ok ? res.data : null;
  };
  try {
    return await applyMapping(mapping, data, executor);
  } catch (err: any) {
    logger.warn(`[responseMapping] failed for tool=${tool.name}: ${err?.message || err}`);
    return data;
  }
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

    return { ok: true, status: res.status, data: await applyResponseMapping(tool, data), meta };
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
