"use client";
import { useState } from "react";
import type { Tool } from "@/lib/types";
import { api } from "@/lib/api";

type Props = {
  initial?: Tool;
  onCancel: () => void;
  onSave: (data: Partial<Tool>) => Promise<void> | void;
};

const DEFAULT_PARAMS = JSON.stringify(
  { type: "object", properties: {}, required: [] },
  null,
  2
);

export default function ToolForm({ initial, onCancel, onSave }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [displayName, setDisplayName] = useState(initial?.displayName || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [usageGuidance, setUsageGuidance] = useState(initial?.usageGuidance || "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [method, setMethod] = useState(initial?.method || "GET");
  const [url, setUrl] = useState(initial?.url || "");
  const [headers, setHeaders] = useState(initial?.headers || "{}");
  const [queryParams, setQueryParams] = useState(initial?.queryParams || "{}");
  const [bodyTemplate, setBodyTemplate] = useState(initial?.bodyTemplate || "{}");
  const [parameters, setParameters] = useState(initial?.parameters || DEFAULT_PARAMS);
  const [parameterPolicy, setParameterPolicy] = useState(initial?.parameterPolicy || "{}");
  const [responseMapping, setResponseMapping] = useState(initial?.responseMapping || "{}");
  const [timeoutMs, setTimeoutMs] = useState(initial?.timeoutMs || 10000);
  const [maxResponseKb, setMaxResponseKb] = useState(initial?.maxResponseKb || 256);
  const [allowedHosts, setAllowedHosts] = useState(initial?.allowedHosts || "[]");
  const [error, setError] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<unknown>(null);

  function validateJson(label: string, value: string) {
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      return `${label}: JSON inválido (${e.message})`;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = [
      validateJson("headers", headers),
      validateJson("queryParams", queryParams),
      validateJson("bodyTemplate", bodyTemplate),
      validateJson("parameters", parameters),
      validateJson("parameterPolicy", parameterPolicy),
      validateJson("responseMapping", responseMapping),
      validateJson("allowedHosts", allowedHosts),
    ].filter(Boolean);
    if (errs.length) {
      setError(errs.join(" · "));
      return;
    }
    setError(null);
    try {
      await onSave({
        name,
        displayName,
        description,
        usageGuidance,
        enabled,
        type: "http",
        method,
        url,
        headers,
        queryParams,
        bodyTemplate,
        parameters,
        parameterPolicy,
        responseMapping,
        timeoutMs: Number(timeoutMs),
        maxResponseKb: Number(maxResponseKb),
        allowedHosts,
      });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTest() {
    if (!initial) {
      setError("Guardá la tool antes de probarla.");
      return;
    }
    try {
      const args = JSON.parse(testArgs);
      const r = await api.testTool(initial.id, args);
      setTestResult(r);
    } catch (e: any) {
      setTestResult({ error: e.message });
    }
  }

  return (
    <form className="col" onSubmit={handleSubmit}>
      {error && <div className="msg system" style={{ color: "var(--danger)" }}>{error}</div>}

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>name (técnico, sin espacios)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required pattern="[a-zA-Z_][a-zA-Z0-9_]*" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>displayName</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div className="field">
          <label>enabled</label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </div>
      </div>

      <div className="field">
        <label>description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="field">
        <label>usageGuidance (cuándo usarla)</label>
        <textarea value={usageGuidance} onChange={(e) => setUsageGuidance(e.target.value)} />
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ width: 120 }}>
          <label>method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>url (soporta {"{{var}}"})</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} required />
        </div>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>timeoutMs</label>
          <input type="number" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>maxResponseKb</label>
          <input type="number" value={maxResponseKb} onChange={(e) => setMaxResponseKb(Number(e.target.value))} />
        </div>
      </div>

      <JsonField label="headers (JSON)" value={headers} onChange={setHeaders} />
      <JsonField label="queryParams (JSON)" value={queryParams} onChange={setQueryParams} />
      <JsonField label="bodyTemplate (JSON)" value={bodyTemplate} onChange={setBodyTemplate} />
      <JsonField label="parameters (JSON Schema)" value={parameters} onChange={setParameters} rows={10} />
      <JsonField label="parameterPolicy (JSON)" value={parameterPolicy} onChange={setParameterPolicy} rows={6} />
      <JsonField label="responseMapping (JSON)" value={responseMapping} onChange={setResponseMapping} />
      <JsonField label="allowedHosts (JSON array)" value={allowedHosts} onChange={setAllowedHosts} />

      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="primary">Guardar</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>

      {initial && (
        <div className="col" style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <strong>Probar tool</strong>
          <JsonField label="args (JSON)" value={testArgs} onChange={setTestArgs} rows={5} />
          <div>
            <button type="button" onClick={handleTest}>Ejecutar</button>
          </div>
          {testResult !== null && (
            <pre style={{ background: "var(--panel)", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 300 }}>
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </form>
  );
}

function JsonField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: "ui-monospace, monospace" }}
      />
    </div>
  );
}
