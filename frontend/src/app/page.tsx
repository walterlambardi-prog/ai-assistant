"use client";

import { useEffect, useRef, useState } from "react";
import { api, audioUrl } from "@/lib/api";
import type { Message, Session } from "@/lib/types";
import SessionSidebar from "@/components/SessionSidebar";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function refreshSessions() {
    const list = await api.listSessions();
    setSessions(list);
    if (!activeId && list.length > 0) setActiveId(list[0].id);
  }

  async function refreshMessages(id: string) {
    const list = await api.listMessages(id);
    setMessages(list);
  }

  useEffect(() => {
    refreshSessions().catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (activeId) refreshMessages(activeId).catch((e) => setErr(String(e)));
    else setMessages([]);
  }, [activeId]);

  async function handleNewSession() {
    const s = await api.createSession({ title: "Nueva sesión" });
    await refreshSessions();
    setActiveId(s.id);
  }

  async function handleRenameSession(id: string, title: string) {
    await api.updateSession(id, { title });
    await refreshSessions();
  }

  async function handleDeleteSession(id: string) {
    await api.deleteSession(id);
    if (activeId === id) setActiveId(null);
    await refreshSessions();
  }

  async function handleSendText(content: string) {
    if (!activeId) return;
    setLoading(true);
    setErr(null);
    try {
      // Optimistic user message
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp_${Date.now()}`,
          sessionId: activeId,
          role: "user",
          content,
          inputType: "text",
          outputType: "none",
          createdAt: new Date().toISOString(),
        } as Message,
      ]);
      await api.sendText(activeId, content);
      await refreshMessages(activeId);
      await refreshSessions();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendVoice(blob: Blob) {
    if (!activeId) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await api.sendVoice(activeId, blob);
      await refreshMessages(activeId);
      await refreshSessions();
      const url = audioUrl(r.audioUrl);
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => undefined);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAskServices() {
    if (!activeId) return;
    handleSendText("¿Qué servicios tenés disponibles?");
  }

  return (
    <div className="layout">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewSession}
        onRename={handleRenameSession}
        onDelete={handleDeleteSession}
      />
      <div className="main">
        <header>
          <div>
            <strong>{sessions.find((s) => s.id === activeId)?.title || "Sin sesión"}</strong>
          </div>
          <div className="row">
            <button onClick={handleAskServices} disabled={!activeId || loading}>
              ¿Qué servicios tenés?
            </button>
            <a href="/admin/tools">
              <button>Admin tools</button>
            </a>
          </div>
        </header>
        {err && (
          <div className="msg system" style={{ color: "var(--danger)" }}>
            {err}
          </div>
        )}
        <MessageList messages={messages} />
        <MessageInput
          disabled={!activeId || loading}
          loading={loading}
          onSendText={handleSendText}
          onSendVoice={handleSendVoice}
        />
        <audio ref={audioRef} hidden />
      </div>
    </div>
  );
}
