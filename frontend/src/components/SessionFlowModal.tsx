"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import {
  User,
  Bot,
  Zap,
  Clock,
  Cpu,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Mic,
  Ban,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Turn = {
  index: number;
  user: Message;
  tools: Message[];
  assistant: Message | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      if (current) turns.push(current);
      current = { index: turns.length, user: m, tools: [], assistant: null };
    } else if (m.role === "tool" && current) {
      current.tools.push(m);
    } else if (m.role === "assistant" && current) {
      current.assistant = m;
    }
  }
  if (current) turns.push(current);
  return turns;
}

function safeJson(s: string | null | undefined): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── JsonViewer ───────────────────────────────────────────────────────────────

function JsonViewer({ data, label }: { data: any; label: string }) {
  const [open, setOpen] = useState(false);
  if (data === null || data === undefined) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-44 overflow-auto rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[10px] leading-relaxed text-foreground/80 scrollbar-thin">
          {str}
        </pre>
      )}
    </div>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

function ToolCard({ msg }: { msg: Message }) {
  const result = safeJson(msg.content);
  const meta = safeJson(msg.metadata);
  const ok = result?.ok !== false;
  const durationMs: number | null = meta?.durationMs ?? null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        ok
          ? "border-amber-500/20 bg-amber-500/[0.04]"
          : "border-destructive/25 bg-destructive/[0.04]"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-mono text-xs font-semibold", ok ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
          {msg.toolName}
        </span>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {durationMs !== null && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
              {formatMs(durationMs)}
            </span>
          )}
          {ok
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            : <XCircle className="h-3.5 w-3.5 text-destructive" />
          }
        </div>
      </div>
      <JsonViewer data={meta?.args} label="Args" />
      <JsonViewer data={result?.data ?? result?.error} label={ok ? "Result" : "Error"} />
    </div>
  );
}

// ─── TurnBlock ────────────────────────────────────────────────────────────────

function TurnBlock({ turn }: { turn: Turn }) {
  const meta = safeJson(turn.assistant?.metadata);
  const userMeta = safeJson(turn.user?.metadata);
  const timing = meta?.timing as {
    totalMs: number; llmMs: number; llmCalls: number; toolMs: number; toolCalls: number; model?: string;
  } | null;
  // cancelled puede estar en el assistant (turno completado y luego cancelado)
  // o en el user (cancelado antes de que el LLM respondiera)
  const cancelled = !!(meta?.cancelled || userMeta?.cancelled);
  const isVoice = turn.user.inputType === "voice";

  if (cancelled) {
    return (
      <div className="relative pb-7">
        <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border/40" />
        <div className="flex items-start gap-3">
          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 bg-muted/50 ring-2 ring-background">
            <Ban className="h-3 w-3 text-muted-foreground/70" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {isVoice ? "Voice" : "User"}
              </p>
              <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-orange-400/80">
                cancelled
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground/60 line-through decoration-muted-foreground/40">
              {turn.user.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connecting line */}
      <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border/60" />

      <div className="space-y-3 pb-7">

        {/* ── User ── */}
        <div className="flex items-start gap-3">
          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 ring-2 ring-background">
            {isVoice
              ? <Mic className="h-3 w-3 text-blue-500" />
              : <User className="h-3 w-3 text-blue-500" />
            }
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500/70">
              {isVoice ? "Voice" : "User"}
            </p>
            <p className="line-clamp-5 text-sm leading-relaxed text-foreground/90">
              {turn.user.content}
            </p>
          </div>
        </div>

        {/* ── Tool calls ── */}
        {turn.tools.map((tool) => (
          <div key={tool.id} className="flex items-start gap-3">
            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 ring-2 ring-background">
              <Zap className="h-3 w-3 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500/70">
                Tool
              </p>
              <ToolCard msg={tool} />
            </div>
          </div>
        ))}

        {/* ── Assistant ── */}
        {turn.assistant && (
          <div className="flex items-start gap-3">
            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 ring-2 ring-background">
              <Bot className="h-3 w-3 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">
                  Assistant
                </p>
                {timing && (
                  <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                      <Cpu className="h-2.5 w-2.5" />
                      {formatMs(timing.llmMs)}
                      {timing.llmCalls > 1 && ` ×${timing.llmCalls}`}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                      <Clock className="h-2.5 w-2.5" />
                      {formatMs(timing.totalMs)}
                    </span>
                    {timing.model && (
                      <span className="rounded border border-border/50 bg-secondary/40 px-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground/50">
                        {timing.model}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="line-clamp-6 text-sm leading-relaxed text-foreground/90">
                {turn.assistant.content}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SessionFlowModal ─────────────────────────────────────────────────────────

type Props = {
  sessionId: string | null;
  sessionTitle: string;
  open: boolean;
  onClose: () => void;
};

export default function SessionFlowModal({
  sessionId,
  sessionTitle,
  open,
  onClose,
}: Readonly<Props>) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    api
      .listMessages(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  const turns = groupTurns(messages);
  const totalTools = turns.reduce((sum, turn) => sum + turn.tools.length, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-5">
          <DialogTitle className="text-base font-semibold">{t("flow.title")}</DialogTitle>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sessionTitle}</p>
          {!loading && turns.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                {turns.length} {t("flow.turns")}
              </span>
              {totalTools > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
                  {totalTools} {t("flow.toolCalls")}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <span className="animate-pulse">{t("flow.loading")}</span>
            </div>
          )}
          {!loading && turns.length === 0 && (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t("flow.empty")}
            </div>
          )}
          {!loading && turns.map((turn) => (
            <TurnBlock key={turn.user.id} turn={turn} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
