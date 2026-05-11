"use client";
import type { Message } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { audioUrl } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronDown, ChevronRight, Wrench, User, Sparkles, Square, Clock, Cpu, Zap, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const ParticlesBackground = dynamic(() => import("@/components/ParticlesBackground"), { ssr: false });
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";

type LightboxImage = { src: string; alt?: string; pageUrl?: string };
const LightboxContext = createContext<(img: LightboxImage) => void>(() => {});
const useLightbox = () => useContext(LightboxContext);

const isImg = (s?: string) =>
  !!s && (
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s) ||
    /^https?:\/\/images\.unsplash\.com\//i.test(s) ||
    /^https?:\/\/upload\.wikimedia\.org\//i.test(s)
  );

export default function MessageList({
  messages,
  loading = false,
  streamingText = null,
  streamingPhase = null,
}: Readonly<{ messages: Message[]; loading?: boolean; streamingText?: string | null; streamingPhase?: string | null }>) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading, streamingText]);

  const visible = useMemo(() => messages.filter((m) => m.role !== "tool"), [messages]);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const openLightbox = useCallback((img: LightboxImage) => setLightbox(img), []);

  if (visible.length === 0 && !loading && streamingText === null) {
    return (
      <div className="flex-1 overflow-y-auto" ref={ref}>
        <EmptyState />
      </div>
    );
  }

  return (
    <LightboxContext.Provider value={openLightbox}>
      <div className="flex-1 overflow-y-auto" ref={ref}>
        <div className="pb-8">
          {visible.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
          {streamingText !== null && <StreamingRow text={streamingText} phase={streamingPhase} />}
          {streamingText === null && loading && <TypingRow phase={streamingPhase} />}
        </div>
      </div>
      {lightbox && <Lightbox image={lightbox} onClose={() => setLightbox(null)} />}
    </LightboxContext.Provider>
  );
}

function Lightbox({ image, onClose }: Readonly<{ image: LightboxImage; onClose: () => void }>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <button
      type="button"
      aria-label="Close image"
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/85 p-6 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Close button top-right */}
      <span
        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
        title="Close (Esc)"
      >
        <X className="h-4 w-4" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt || ""}
        className="max-h-[85vh] max-w-[92vw] cursor-default rounded-md object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {/* Caption + link below */}
      {(image.alt || image.pageUrl) && (
        <div
          className="flex flex-col items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {image.alt && (
            <span className="max-w-[80vw] truncate text-center text-xs text-white/80">
              {image.alt}
            </span>
          )}
          {image.pageUrl && (
            <a
              href={image.pageUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-white/50 underline underline-offset-2 hover:text-white/90"
            >
              <ExternalLink className="h-3 w-3" />
              Open source
            </a>
          )}
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  const { t } = useI18n();
  const sub = t("messages.emptySub");
  const linkText = t("messages.emptySubTools");
  const parts = sub.split("{tools}");
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {/* particles layer */}
      <ParticlesBackground />

      {/* glass card */}
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center px-10 py-12 text-center">
        {/* glow ring behind icon */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 blur-2xl scale-150" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl ring-1 ring-emerald-500/30">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>

        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground">
          {t("messages.empty")}
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {parts[0]}
          <Link
            href="/admin/tools"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {linkText}
          </Link>
          {parts[1] ?? ""}
        </p>
      </div>
    </div>
  );
}

function Avatar({ role }: Readonly<{ role: Message["role"] }>) {
  if (role === "user")
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
        <User className="h-4 w-4" />
      </div>
    );
  if (role === "assistant")
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
    );
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-secondary text-muted-foreground">
      <Wrench className="h-3.5 w-3.5" />
    </div>
  );
}

function TypingRow({ phase }: Readonly<{ phase?: string | null }>) {
  return (
    <MessageShell role="assistant" label="Assistant">
      {phase ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {phase}…
        </div>
      ) : (
        <div className="typing-dots">
          <span /> <span /> <span />
        </div>
      )}
    </MessageShell>
  );
}

function StreamingRow({ text, phase }: Readonly<{ text: string; phase?: string | null }>) {
  return (
    <MessageShell role="assistant" label="Assistant">
      {phase && (
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {phase}…
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text || " "}
        </ReactMarkdown>
        <span className="inline-block h-4 w-0.5 animate-pulse bg-current align-middle opacity-75 ml-0.5" />
      </div>
    </MessageShell>
  );
}

function MessageShell({
  role,
  label,
  headerRight,
  children,
}: Readonly<{
  role: Message["role"];
  label: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}>) {
  const isAssistant = role === "assistant";
  return (
    <div
      className={cn(
        "group w-full animate-fade-in border-b border-border/50",
        isAssistant ? "bg-card/40" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-3xl gap-4 px-4 py-6 sm:px-6">
        <Avatar role={role} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted-foreground">{label}</div>
            {headerRight && (
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                {headerRight}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MessageRow({ message }: Readonly<{ message: Message }>) {
  const { t } = useI18n();
  const isUser = message.role === "user";
  const timing = !isUser ? parseTiming(message.metadata) : null;
  const tools = !isUser ? parseTools(message.metadata) : [];
  const cancelled = parseCancelled(message.metadata);
  const showActions = !isUser && !!message.content && !cancelled;
  return (
    <MessageShell
      role={message.role}
      label={isUser ? "You" : "Assistant"}
      headerRight={showActions ? <CopyButton text={message.content} /> : undefined}
    >
      <div className={cn(cancelled && "opacity-60")}>
        {isUser ? (
          <div className={cn("whitespace-pre-wrap text-[15.5px] leading-relaxed text-foreground/90", cancelled && "line-through decoration-muted-foreground/50")}>
            {message.content}
          </div>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children, node }) => {
                  const childArr = Array.isArray(children) ? children : [children];
                  const hasElementChild = childArr.some((c) => typeof c === "object" && c !== null);
                  // Case: [![alt](img_url)](page_url) — link wrapping an image
                  if (hasElementChild) {
                    // Extract img src from hast node to avoid the <a> navigating
                    const imgNode = (node as any)?.children?.find((c: any) => c.tagName === "img");
                    const imgSrc = imgNode?.properties?.src as string | undefined;
                    const imgAlt = imgNode?.properties?.alt as string | undefined;
                    if (imgSrc) {
                      return <ChatImage src={imgSrc} alt={imgAlt} pageUrl={href ?? undefined} />;
                    }
                    // Fallback: render as non-navigating span
                    return <span>{children}</span>;
                  }
                  // Case: [alt](img_url) — direct image link
                  if (isImg(href)) {
                    return <ChatImage src={href!} alt={childArr.map(String).join("")} />;
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer noopener">
                      {children}
                    </a>
                  );
                },
                img: ({ src, alt }) => <ChatImage src={src as string} alt={alt} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {cancelled && (
        <div className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Square className="h-2.5 w-2.5 fill-current" />
          {t("messages.cancelled")}
        </div>
      )}
      {message.audioUrl && audioUrl(message.audioUrl) && (
        <AudioPlayer src={audioUrl(message.audioUrl)!} />
      )}
      {!cancelled && (tools.length > 0 || timing) && (
        <MessageMeta tools={tools} timing={timing} />
      )}
    </MessageShell>
  );
}

function MessageMeta({
  tools,
  timing,
}: Readonly<{ tools: ToolUsage[]; timing: Timing | null }>) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="mt-3 flex flex-col gap-2">
      {tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tools.map((tu, i) => {
            const open = openIdx === i;
            const ok = tu.ok !== false;
            return (
              <button
                key={`${tu.name}-${i}`}
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 transition-colors",
                  ok
                    ? "border-border bg-secondary/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                    : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
                  open && "ring-1 ring-ring"
                )}
                title={tu.name}
              >
                <Wrench className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate max-w-[180px]">{tu.displayName || tu.name}</span>
                {typeof tu.durationMs === "number" && (
                  <span className="font-mono tabular-nums opacity-60">
                    {formatDuration(tu.durationMs)}
                  </span>
                )}
                {open ? (
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      )}
      {timing && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-5 text-muted-foreground/80">
          <MetaStat
            icon={<Cpu className="h-3 w-3" />}
            label="LLM"
            value={formatDuration(timing.llmMs)}
            extra={timing.llmCalls > 1 ? `×${timing.llmCalls}` : undefined}
            title={`LLM time across ${timing.llmCalls} call${timing.llmCalls === 1 ? "" : "s"}`}
          />
          {timing.toolCalls > 0 && (
            <MetaStat
              icon={<Zap className="h-3 w-3" />}
              label="Tools"
              value={formatDuration(timing.toolMs)}
              extra={`×${timing.toolCalls}`}
              title={`Total time spent in ${timing.toolCalls} tool call${timing.toolCalls === 1 ? "" : "s"}`}
            />
          )}
          <MetaStat
            icon={<Clock className="h-3 w-3" />}
            label="Total"
            value={formatDuration(timing.totalMs)}
            title="End-to-end turn duration"
          />
          <span
            className="inline-flex items-center rounded border border-border/60 bg-secondary/40 px-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70"
            title={timing.model}
          >
            {timing.model}
          </span>
        </div>
      )}
      {openIdx !== null && tools[openIdx] && <ToolDetail tool={tools[openIdx]} />}
    </div>
  );
}

function MetaStat({
  icon,
  label,
  value,
  extra,
  title,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string;
  extra?: string;
  title?: string;
}>) {
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <span className="opacity-60">{icon}</span>
      <span className="opacity-70">{label}</span>
      <span className="font-mono tabular-nums text-foreground/80">{value}</span>
      {extra && <span className="opacity-50">{extra}</span>}
    </span>
  );
}

function parseCancelled(metadata?: string | null): boolean {
  if (!metadata) return false;
  try {
    return Boolean(JSON.parse(metadata)?.cancelled);
  } catch {
    return false;
  }
}

type Timing = {
  totalMs: number;
  llmMs: number;
  llmCalls: number;
  toolMs: number;
  toolCalls: number;
  model: string;
};

function parseTiming(metadata?: string | null): Timing | null {
  if (!metadata) return null;
  try {
    const obj = JSON.parse(metadata);
    if (obj?.timing && typeof obj.timing.totalMs === "number") return obj.timing as Timing;
  } catch {
    /* ignore */
  }
  return null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}

function ChatImage({ src, alt, pageUrl }: Readonly<{ src: string; alt?: string; pageUrl?: string }>) {
  const open = useLightbox();
  return (
    <figure
      className="my-2 flex w-fit flex-col overflow-hidden rounded-lg border border-border bg-secondary/30 transition-shadow hover:shadow-lg"
      style={{ maxWidth: "min(480px, 100%)" }}
    >
      <button
        type="button"
        onClick={() => open({ src, alt, pageUrl })}
        className="group/img block focus:outline-none focus:ring-2 focus:ring-ring"
        title="Open image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ""}
          className="max-h-80 w-full cursor-pointer object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
        />
      </button>
      {alt && (
        <figcaption className="px-2.5 py-1.5 text-[11px] text-muted-foreground leading-snug">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

function CopyButton({ text }: Readonly<{ text: string }>) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={copied ? "Copied" : "Copy"}
      title={copied ? "Copied" : "Copy"}
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function ToolDetail({ tool }: Readonly<{ tool: ToolUsage }>) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <code className="font-mono text-muted-foreground">{tool.name}</code>
        {typeof tool.status === "number" && (
          <span className="font-mono text-muted-foreground">HTTP {tool.status}</span>
        )}
      </div>
      {tool.error && (
        <div className="mb-1.5 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-destructive">
          {tool.error}
        </div>
      )}
      {tool.args && Object.keys(tool.args).length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
            args
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/50 p-2 font-mono text-muted-foreground">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

type ToolUsage = {
  name: string;
  displayName?: string;
  ok?: boolean;
  durationMs?: number;
  status?: number;
  error?: string;
  args?: Record<string, unknown>;
};

function parseTools(metadata?: string | null): ToolUsage[] {
  if (!metadata) return [];
  try {
    const obj = JSON.parse(metadata);
    if (Array.isArray(obj?.tools)) return obj.tools as ToolUsage[];
  } catch {
    /* ignore */
  }
  return [];
}
