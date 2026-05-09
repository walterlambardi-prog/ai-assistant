"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tool } from "@/lib/types";
import ToolList from "@/components/ToolList";
import ToolForm from "@/components/ToolForm";

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar tool?")) return;
    await api.deleteTool(id);
    await refresh();
  }

  async function handleToggle(t: Tool) {
    await api.updateTool(t.id, { enabled: !t.enabled });
    await refresh();
  }

  const showForm = creating || editing;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Tools dinámicas</h1>
        <div className="row">
          <a href="/">
            <button>← Chat</button>
          </a>
          {!showForm && (
            <button className="primary" onClick={() => setCreating(true)}>
              + Nueva tool
            </button>
          )}
        </div>
      </header>

      {err && <div className="msg system" style={{ color: "var(--danger)" }}>{err}</div>}

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
          onDelete={(id) => handleDelete(id)}
          onToggle={(t) => handleToggle(t)}
        />
      )}
    </div>
  );
}
