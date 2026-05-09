"use client";
import type { Tool } from "@/lib/types";

type Props = {
  tools: Tool[];
  onEdit: (t: Tool) => void;
  onDelete: (id: string) => void;
  onToggle: (t: Tool) => void;
};

export default function ToolList({ tools, onEdit, onDelete, onToggle }: Props) {
  if (tools.length === 0) {
    return <div className="empty">No hay tools. Creá una para que la AI pueda usarla.</div>;
  }
  return (
    <table className="tool-table">
      <thead>
        <tr>
          <th>Estado</th>
          <th>Nombre</th>
          <th>Display</th>
          <th>Método</th>
          <th>URL</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {tools.map((t) => (
          <tr key={t.id}>
            <td>
              <span className={`tag ${t.enabled ? "on" : ""}`}>
                {t.enabled ? "ON" : "OFF"}
              </span>
            </td>
            <td><code>{t.name}</code></td>
            <td>{t.displayName}</td>
            <td>{t.method}</td>
            <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.url}
            </td>
            <td>
              <div className="row">
                <button onClick={() => onToggle(t)}>{t.enabled ? "Desactivar" : "Activar"}</button>
                <button onClick={() => onEdit(t)}>Editar</button>
                <button className="danger" onClick={() => onDelete(t.id)}>Borrar</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
