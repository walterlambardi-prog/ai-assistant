"use client";
import type { Tool } from "@/lib/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Power, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tools: Tool[];
  onEdit: (t: Tool) => void;
  onDelete: (id: string) => void;
  onToggle: (t: Tool) => void;
};

export default function ToolList({ tools, onEdit, onDelete, onToggle }: Readonly<Props>) {
  const { t: tr } = useI18n();
  if (tools.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Globe className="h-8 w-8 opacity-40" />
        <div className="text-sm">{tr("tools.empty")}</div>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {tools.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    t.enabled ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-muted-foreground/40"
                  )}
                />
                <h3 className="truncate text-sm font-semibold">{t.displayName}</h3>
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {t.name}
                </code>
              </div>
              {t.description && (
                <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">
                  {t.method}
                </span>
                <span className="truncate font-mono">{t.url}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => onToggle(t)} className="gap-1.5">
                <Power className="h-3.5 w-3.5" />
                {t.enabled ? tr("tools.disable") : tr("tools.enable")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(t)} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                {tr("tools.edit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(t.id)}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
