"use client";
import { useState } from "react";
import type { Tool } from "@/lib/types";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Plus, Save, X, Play, Trash2 } from "lucide-react";

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

export default function ToolForm({ initial, onCancel, onSave }: Readonly<Props>) {
  const { t: tr } = useI18n();
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
  const [secrets, setSecrets] = useState<Array<{ key: string; value: string; placeholder: boolean }>>(
    () => {
      try {
        const obj = JSON.parse(initial?.secrets || "{}") as Record<string, string>;
        return Object.entries(obj).map(([key, value]) => ({
          key,
          value: value === "***" ? "" : value,
          placeholder: value === "***",
        }));
      } catch {
        return [];
      }
    }
  );
  const [error, setError] = useState<string | null>(null);
  const [testArgs, setTestArgs] = useState("{}");
  const [testResult, setTestResult] = useState<unknown>(null);

  function buildSecretsJson(): string {
    const out: Record<string, string> = {};
    for (const { key, value, placeholder } of secrets) {
      const k = key.trim();
      if (!k) continue;
      out[k] = placeholder && value === "" ? "***" : value;
    }
    return JSON.stringify(out);
  }

  function validateJson(label: string, value: string) {
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      return tr("toolForm.invalidJson", { label, msg: e.message });
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
        secrets: buildSecretsJson(),
      });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTest() {
    if (!initial) {
      setError(tr("toolForm.saveBeforeTest"));
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr("toolForm.sectionGeneral")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">name</Label>
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                pattern="[a-zA-Z_][a-zA-Z0-9_]*"
                placeholder="my_tool"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-display">displayName</Label>
              <Input
                id="t-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="My Tool"
              />
            </div>
            <div className="flex items-end">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-secondary"
                />
                enabled
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-usage">usageGuidance</Label>
            <Textarea
              id="t-usage"
              value={usageGuidance}
              onChange={(e) => setUsageGuidance(e.target.value)}
              rows={2}
              placeholder="When should the model use this tool?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr("toolForm.sectionHttp")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1.5">
              <Label>method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-url">url (supports {"{{var}}"})</Label>
              <Input
                id="t-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://api.example.com/{{path}}"
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-timeout">timeoutMs</Label>
              <Input
                id="t-timeout"
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-maxkb">maxResponseKb</Label>
              <Input
                id="t-maxkb"
                type="number"
                value={maxResponseKb}
                onChange={(e) => setMaxResponseKb(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr("toolForm.sectionJson")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <JsonField label="headers" value={headers} onChange={setHeaders} />
          <JsonField label="queryParams" value={queryParams} onChange={setQueryParams} />
          <JsonField label="bodyTemplate" value={bodyTemplate} onChange={setBodyTemplate} />
          <JsonField label="parameters (JSON Schema)" value={parameters} onChange={setParameters} rows={10} />
          <JsonField label="parameterPolicy" value={parameterPolicy} onChange={setParameterPolicy} rows={6} />
          <JsonField label="responseMapping" value={responseMapping} onChange={setResponseMapping} />
          <JsonField label="allowedHosts (JSON array)" value={allowedHosts} onChange={setAllowedHosts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr("toolForm.secrets").split(" —")[0]}</CardTitle>
          <CardDescription>{tr("toolForm.secretsHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {secrets.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="VAR_NAME"
                value={s.key}
                onChange={(e) => {
                  const copy = [...secrets];
                  copy[i] = { ...copy[i], key: e.target.value };
                  setSecrets(copy);
                }}
                className="font-mono"
              />
              <Input
                type="password"
                placeholder={s.placeholder ? "*** (current; empty = keep)" : "value"}
                value={s.value}
                onChange={(e) => {
                  const copy = [...secrets];
                  copy[i] = { ...copy[i], value: e.target.value };
                  setSecrets(copy);
                }}
                className="flex-[2]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setSecrets(secrets.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSecrets([...secrets, { key: "", value: "", placeholder: false }])}
          >
            <Plus className="h-4 w-4" />
            {tr("toolForm.secretsAdd").replace(/^\+\s*/, "")}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" className="gap-2">
          <Save className="h-4 w-4" />
          {tr("toolForm.save")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
          <X className="h-4 w-4" />
          {tr("toolForm.cancel")}
        </Button>
      </div>

      {initial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("toolForm.test")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <JsonField label="args" value={testArgs} onChange={setTestArgs} rows={5} />
            <Button type="button" variant="outline" onClick={handleTest} className="gap-2">
              <Play className="h-4 w-4" />
              {tr("toolForm.testRun")}
            </Button>
            {testResult !== null && (
              <>
                <Separator />
                <pre className="max-h-80 overflow-auto rounded-md border border-border bg-secondary/50 p-3 font-mono text-xs">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </form>
  );
}

function JsonField({
  label,
  value,
  onChange,
  rows = 4,
}: Readonly<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}
