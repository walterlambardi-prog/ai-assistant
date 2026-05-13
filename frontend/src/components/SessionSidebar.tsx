"use client";
import type { Session } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MessageSquarePlus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  Wrench,
  MessageSquare,
  GitBranch,
  X,
} from "lucide-react";
import SessionFlowModal from "@/components/SessionFlowModal";

type Props = {
  sessions: Session[];
  activeId: string | null;
  processingIds?: Set<string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
};

type Group = { label: string; items: Session[] };

function groupSessions(sessions: Session[], t: (k: string) => string): Group[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const last7 = today - 6 * 86_400_000;
  const last30 = today - 29 * 86_400_000;

  const buckets: Record<string, Session[]> = {
    today: [], yesterday: [], last7: [], last30: [], older: [],
  };
  for (const s of sessions) {
    const ts = new Date(s.updatedAt || s.createdAt || now).getTime();
    if (ts >= today) buckets.today.push(s);
    else if (ts >= yesterday) buckets.yesterday.push(s);
    else if (ts >= last7) buckets.last7.push(s);
    else if (ts >= last30) buckets.last30.push(s);
    else buckets.older.push(s);
  }
  const out: Group[] = [];
  if (buckets.today.length) out.push({ label: t("sidebar.groupToday"), items: buckets.today });
  if (buckets.yesterday.length) out.push({ label: t("sidebar.groupYesterday"), items: buckets.yesterday });
  if (buckets.last7.length) out.push({ label: t("sidebar.groupLast7"), items: buckets.last7 });
  if (buckets.last30.length) out.push({ label: t("sidebar.groupLast30"), items: buckets.last30 });
  if (buckets.older.length) out.push({ label: t("sidebar.groupOlder"), items: buckets.older });
  return out;
}

export default function SessionSidebar({
  sessions, activeId, processingIds, onSelect, onNew, onRename, onDelete, onDeleteAll,
}: Readonly<Props>) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Session[] | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [flowSessionId, setFlowSessionId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.searchSessions(query.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const displayed = searchResults ?? sessions;
  const groups = useMemo(() => groupSessions(displayed, t), [displayed, t]);
  const pendingDeleteSession = sessions.find((s) => s.id === pendingDeleteId) ?? searchResults?.find((s) => s.id === pendingDeleteId);

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center justify-between gap-2 px-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-xs font-bold shadow">
            AI
          </div>
          <span className="text-sm font-semibold">{t("sidebar.title")}</span>
        </div>
        <Button size="icon" variant="ghost" onClick={onNew} title={t("sidebar.newSession")}>
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("sidebar.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-2 pb-2">
        <Button onClick={onNew} className="w-full justify-start gap-2 h-9" variant="secondary">
          <MessageSquarePlus className="h-4 w-4" />
          {t("sidebar.newSession")}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        {displayed.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            {t("sidebar.empty")}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((s) => {
                const isActive = s.id === activeId;
                const isEditing = editingId === s.id;
                const isProcessing = processingIds?.has(s.id) ?? false;
                return (
                  <li key={s.id}>
                    <div
                      className={cn(
                        "group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                      )}
                      onClick={() => { if (!isEditing) onSelect(s.id); }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />

                      {isProcessing && (
                        <span className="mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-label="processing" />
                      )}
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => {
                            const trimmed = editTitle.trim();
                            if (trimmed && trimmed !== s.title) onRename(s.id, trimmed);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                            if (e.key === "Escape") { e.preventDefault(); setEditingId(null); }
                          }}
                          className="min-w-0 flex-1 bg-background border border-ring rounded px-1.5 py-0.5 text-xs outline-none"
                        />
                      ) : (
                        <span className="w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{s.title}</span>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none"
                            aria-label="More"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => { setEditTitle(s.title); setEditingId(s.id); }}>
                            <Pencil className="h-3.5 w-3.5" />
                            {t("sidebar.renameTitle")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFlowSessionId(s.id)}>
                            <GitBranch className="h-3.5 w-3.5" />
                            {t("flow.menuItem")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDeleteId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("sidebar.deleteTitle")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </ScrollArea>

      <div className="p-2 space-y-0.5">
        <a
          href="/admin/tools"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-accent/50 hover:text-foreground"
        >
          <Wrench className="h-4 w-4" />
          {t("header.adminTools")}
        </a>
        <a
          href="/admin/config"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-accent/50 hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          {t("header.config")}
        </a>
        {sessions.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t("sidebar.deleteAll")}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("sidebar.deleteAllTitle")}</DialogTitle>
                <DialogDescription>{t("sidebar.deleteAllDesc")}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="ghost" asChild>
                  <DialogTrigger>{t("sidebar.cancel")}</DialogTrigger>
                </Button>
                <Button
                  variant="destructive"
                  onClick={onDeleteAll}
                >
                  {t("sidebar.deleteAllConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Dialog confirmar borrar una sesión */}
      <Dialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sidebar.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {pendingDeleteSession
                ? t("sidebar.deleteSessionDesc").replace("{title}", pendingDeleteSession.title)
                : t("sidebar.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
              {t("sidebar.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) onDelete(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              {t("sidebar.deleteTitle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow modal */}
      <SessionFlowModal
        sessionId={flowSessionId}
        sessionTitle={sessions.find((s) => s.id === flowSessionId)?.title ?? ""}
        open={!!flowSessionId}
        isProcessing={flowSessionId ? (processingIds?.has(flowSessionId) ?? false) : false}
        onClose={() => setFlowSessionId(null)}
      />
    </aside>
  );
}
