"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tool } from "@/lib/types";
import ToolList from "@/components/ToolList";
import ToolForm from "@/components/ToolForm";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Settings, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AdminToolsPage() {
  const { t } = useI18n();
  const [tools, setTools] = useState<Tool[]>([]);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTools(await api.listTools());
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function handleSave(data: Partial<Tool>) {
    try {
      setErr(null);
      if (editing) await api.updateTool(editing.id, data);
      else await api.createTool(data);
      setEditing(null);
      setCreating(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    await api.deleteTool(pendingDeleteId);
    setPendingDeleteId(null);
    await refresh();
  }

  async function handleToggle(tool: Tool) {
    await api.updateTool(tool.id, { enabled: !tool.enabled });
    await refresh();
  }

  const showForm = creating || editing;
  const pendingTool = tools.find((t) => t.id === pendingDeleteId);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t("tools.back")}
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-base font-semibold">{t("tools.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/config">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Config
              </Button>
            </Link>
            {!showForm && (
              <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                {t("tools.newTool")}
              </Button>
            )}
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

        {showForm ? (
          <ToolForm
            initial={editing || undefined}
            onCancel={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={handleSave}
          />
        ) : (
          <ToolList
            tools={tools}
            onEdit={(t) => setEditing(t)}
            onDelete={(id) => setPendingDeleteId(id)}
            onToggle={(t) => handleToggle(t)}
          />
        )}
      </main>

      <Dialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("tools.deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {pendingTool
                ? t("tools.deleteConfirmDesc").replace("{name}", pendingTool.displayName || pendingTool.name)
                : t("tools.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
              {t("sidebar.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("tools.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
