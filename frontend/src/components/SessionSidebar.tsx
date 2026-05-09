"use client";
import type { Session } from "@/lib/types";
import { useState } from "react";

type Props = {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export default function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  return (
    <aside className="sidebar">
      <header>
        <h1>Sesiones</h1>
        <button onClick={onNew} className="primary">
          + Nueva
        </button>
      </header>
      <ul>
        {sessions.length === 0 && <li className="empty">Sin sesiones</li>}
        {sessions.map((s) => (
          <li
            key={s.id}
            className={s.id === activeId ? "active" : ""}
            onClick={() => onSelect(s.id)}
          >
            {editingId === s.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => {
                  if (editTitle.trim()) onRename(s.id, editTitle.trim());
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.title}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(s.id);
                    setEditTitle(s.title);
                  }}
                  title="Renombrar"
                  style={{ fontSize: 12 }}
                >
                  ✎
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("¿Borrar sesión?")) onDelete(s.id);
                  }}
                  title="Borrar"
                  style={{ fontSize: 12 }}
                >
                  🗑
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <footer>
        <a href="/admin/tools">
          <button style={{ width: "100%" }}>⚙️ Admin Tools</button>
        </a>
      </footer>
    </aside>
  );
}
