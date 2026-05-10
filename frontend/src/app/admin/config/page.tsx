"use client";

import { useEffect, useRef, useState } from "react";
import { api, audioUrl } from "@/lib/api";
import type { AppConfig, OllamaModel } from "@/lib/types";
import { useI18n, type Locale } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  ArrowLeft,
  Check,
  AlertCircle,
  RefreshCw,
  Volume2,
  Globe,
  Bot,
  Sliders,
  Wrench,
  Loader2,
  Play,
} from "lucide-react";
import Link from "next/link";

export default function AdminConfigPage() {
  const { t, locale, setLocale } = useI18n();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [voices, setVoices] = useState<{ name: string; locale: string; sample: string }[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [voiceFilter, setVoiceFilter] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function loadModels() {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const r = await api.listOllamaModels();
      setModels(r.models);
    } catch (e: any) {
      setModelsError(e.message);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    api.getConfig().then(setCfg).catch((e) => setErr(e.message));
    loadModels();
    api.listTtsVoices().then((r) => setVoices(r.voices)).catch((e) => setVoicesError(e.message));
  }, []);

  async function testVoice() {
    if (!cfg) return;
    setTesting(true);
    setErr(null);
    try {
      const lang = cfg.language ?? locale;
      const r = await api.previewTtsVoice({
        voice: cfg.ttsVoice,
        rate: cfg.ttsRate,
        language: lang,
      });
      const url = audioUrl(r.url);
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const updated = await api.updateConfig({
        defaultModel: cfg.defaultModel,
        temperature: cfg.temperature,
        topP: cfg.topP,
        ollamaBaseUrl: cfg.ollamaBaseUrl,
        ttsEnabled: cfg.ttsEnabled,
        sttEnabled: cfg.sttEnabled,
        ttsVoice: cfg.ttsVoice,
        ttsRate: cfg.ttsRate,
        language: cfg.language,
        systemPromptEn: cfg.systemPromptEn,
        systemPromptEs: cfg.systemPromptEs,
      });
      setCfg(updated);
      setOk(t("config.saved"));
      loadModels();
      setTimeout(() => setOk(null), 3000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {err ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            {err}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("config.loading")}
          </div>
        )}
      </div>
    );
  }

  const filteredVoices = voices.filter(
    (v) =>
      !voiceFilter ||
      v.locale.toLowerCase().includes(voiceFilter.toLowerCase()) ||
      v.name.toLowerCase().includes(voiceFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("config.backChat")}
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-base font-semibold">{t("config.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/tools">
              <Button variant="outline" size="sm" className="gap-2">
                <Wrench className="h-4 w-4" />
                {t("config.toolsLink")}
              </Button>
            </Link>
            <Button onClick={save} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? t("config.saving") : t("config.save")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {err}
          </div>
        )}
        {ok && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            {ok}
          </div>
        )}

        <div className="space-y-6">
          {/* General */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("config.language")}</CardTitle>
              </div>
              <CardDescription>{t("config.languageHelp")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <Select
                  value={cfg.language ?? locale}
                  onValueChange={(v) => {
                    const l = v as Locale;
                    setCfg({ ...cfg, language: l });
                    setLocale(l);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Model */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("config.defaultModel")}</CardTitle>
              </div>
              <CardDescription>Ollama: {cfg.ollamaBaseUrl}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ollama-url">{t("config.ollamaUrl")}</Label>
                <Input
                  id="ollama-url"
                  value={cfg.ollamaBaseUrl}
                  onChange={(e) => setCfg({ ...cfg, ollamaBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">{t("config.defaultModel")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="model"
                    value={cfg.defaultModel}
                    onChange={(e) => setCfg({ ...cfg, defaultModel: e.target.value })}
                    placeholder="qwen2.5:7b"
                  />
                  <Button
                    variant="outline"
                    onClick={loadModels}
                    disabled={loadingModels}
                    className="shrink-0 gap-2"
                  >
                    <RefreshCw className={loadingModels ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                    {t("config.refresh")}
                  </Button>
                </div>
                {modelsError && (
                  <p className="text-xs text-destructive">
                    {t("config.ollamaError", { msg: modelsError })}
                  </p>
                )}
              </div>

              {models.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t("config.clickToUse")}</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {models.map((m) => {
                      const active = m.name === cfg.defaultModel;
                      return (
                        <button
                          key={m.name}
                          onClick={() => setCfg({ ...cfg, defaultModel: m.name })}
                          className={
                            active
                              ? "rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400"
                              : "rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          }
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sampling */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Sampling</CardTitle>
              </div>
              <CardDescription>Temperature & top_p</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="temp">temperature ({cfg.temperature})</Label>
                  <Input
                    id="temp"
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={cfg.temperature}
                    onChange={(e) => setCfg({ ...cfg, temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="topp">top_p ({cfg.topP})</Label>
                  <Input
                    id="topp"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={cfg.topP}
                    onChange={(e) => setCfg({ ...cfg, topP: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voice */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("config.ttsSection")}</CardTitle>
              </div>
              <CardDescription>Text-to-Speech & Speech-to-Text</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.ttsEnabled}
                    onChange={(e) => setCfg({ ...cfg, ttsEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border bg-secondary"
                  />
                  {t("config.ttsEnabled")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.sttEnabled}
                    onChange={(e) => setCfg({ ...cfg, sttEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border bg-secondary"
                  />
                  {t("config.sttEnabled")}
                </label>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_120px]">
                <div className="space-y-1.5">
                  <Label>{t("config.voice")}</Label>
                  <Select
                    value={cfg.ttsVoice || "_default"}
                    onValueChange={(v) => setCfg({ ...cfg, ttsVoice: v === "_default" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_default">{t("config.voiceDefault")}</SelectItem>
                      {filteredVoices.map((v) => (
                        <SelectItem key={`${v.name}-${v.locale}`} value={v.name}>
                          {v.name} — {v.locale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("config.voiceFilter")}</Label>
                  <Input
                    value={voiceFilter}
                    onChange={(e) => setVoiceFilter(e.target.value)}
                    placeholder={t("config.voiceFilterPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("config.rate")}</Label>
                  <Input
                    type="number"
                    min={80}
                    max={500}
                    step={10}
                    value={cfg.ttsRate ?? ""}
                    placeholder="190"
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        ttsRate: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {voicesError && (
                <p className="text-xs text-destructive">
                  {t("config.voicesError", { msg: voicesError })}
                </p>
              )}
              {!voicesError && voices.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("config.voicesLoading")}</p>
              )}
              {cfg.ttsVoice && (
                <p className="text-xs text-muted-foreground">
                  {t("config.sample")}:{" "}
                  <em>{voices.find((v) => v.name === cfg.ttsVoice)?.sample || "—"}</em>
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testVoice}
                  disabled={testing}
                  className="gap-2"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {testing ? t("config.testing") : t("config.testVoice")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("config.testVoiceHelp")}</p>
              </div>

              <audio ref={audioRef} hidden>
                <track kind="captions" />
              </audio>
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{t("config.systemPrompt")}</CardTitle>
              </div>
              <CardDescription>{t("config.systemPromptHelp")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("config.systemPromptEn")}</Label>
                <textarea
                  rows={10}
                  value={cfg.systemPromptEn ?? ""}
                  onChange={(e) => setCfg({ ...cfg, systemPromptEn: e.target.value || null })}
                  placeholder={t("config.systemPromptPlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("config.systemPromptEs")}</Label>
                <textarea
                  rows={10}
                  value={cfg.systemPromptEs ?? ""}
                  onChange={(e) => setCfg({ ...cfg, systemPromptEs: e.target.value || null })}
                  placeholder={t("config.systemPromptPlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
            </CardContent>
          </Card>

          <p className="pt-2 text-xs text-muted-foreground">{t("config.footnote")}</p>
        </div>
      </main>
    </div>
  );
}
