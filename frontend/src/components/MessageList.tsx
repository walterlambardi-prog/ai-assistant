"use client";
import type { Message } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { audioUrl } from "@/lib/api";

export default function MessageList({ messages }: { messages: Message[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="messages" ref={ref}>
      {messages.length === 0 && <div className="empty">No hay mensajes aún. Escribí algo!</div>}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);

  if (message.role === "tool") {
    return (
      <div className="msg tool">
        <div onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
          🔧 tool: <strong>{message.toolName}</strong> {open ? "▾" : "▸"}
        </div>
        {open && (
          <pre style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
            {prettyJson(message.content)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className={`msg ${message.role}`}>
      {message.content}
      {message.audioUrl && (
        <div style={{ marginTop: 6 }}>
          <audio controls src={audioUrl(message.audioUrl) || undefined} />
        </div>
      )}
    </div>
  );
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
