"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, audioUrl } from "@/lib/api";
import type { Message, Session } from "@/lib/types";
import SessionSidebar from "@/components/SessionSidebar";
import MessageList from "@/components/MessageList";
import MessageInput from "@/components/MessageInput";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";

export default function HomePage() {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const backgroundSessionsRef = useRef<Map<string, number>>(new Map());

  // Tool-call phase shown while streaming (null = idle, string = tool displayName)
  const [streamingPhase, setStreamingPhase] = useState<string | null>(null);
  // Session IDs whose backend processing is still running after the user switched away
  const [backgroundSessionIds, setBackgroundSessionIds] = useState<Set<string>>(new Set());

  function stopAllAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    document.querySelectorAll("audio").forEach((el) => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    });
    setAudioPlaying(false);
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopAllAudio();
    setLoading(false);
    if (activeId) {
      // Signal backend to exit the tool loop, and mark messages as cancelled.
      api.cancelSession(activeId).catch(() => undefined);
      api
        .cancelLast(activeId)
        .then(() => refreshMessages(activeId))
        .catch(() => undefined);
    }
  }

  async function refreshSessions() {
    const list = await api.listSessions();
    setSessions(list);
    if (!activeId && list.length > 0) setActiveId(list[0].id);
  }

  async function refreshMessages(id: string) {
    const list = await api.listMessages(id);
    setMessages(list);
  }

  async function refreshMessagesAndCheckProcessing(id: string) {
    const [list, session] = await Promise.all([api.listMessages(id), api.getSession(id)]);
    setMessages(list);
    if (session.isProcessing) {
      // Backend is still running — show loader and track for polling
      setLoading(true);
      const prevCount = list.length;
      backgroundSessionsRef.current.set(id, prevCount);
      setBackgroundSessionIds((prev) => new Set([...prev, id]));
    }
  }

  useEffect(() => {
    refreshSessions().catch((e) => setErr(String(e)));
  }, []);

  // Listen for any <audio> element on the page playing/pausing/ending
  // so we can keep an accurate global "audio playing" indicator and
  // enable the Stop button whenever audio is active (including the
  // per-message <audio controls> inside MessageList).
  useEffect(() => {
    function onPlay() {
      setAudioPlaying(true);
    }
    function onPauseOrEnd() {
      // Defer one tick so multiple events settle before we re-check.
      setTimeout(() => {
        const anyPlaying = Array.from(document.querySelectorAll("audio")).some(
          (el) => !el.paused && !el.ended
        );
        setAudioPlaying(anyPlaying);
      }, 0);
    }
    document.addEventListener("play", onPlay, true);
    document.addEventListener("pause", onPauseOrEnd, true);
    document.addEventListener("ended", onPauseOrEnd, true);
    return () => {
      document.removeEventListener("play", onPlay, true);
      document.removeEventListener("pause", onPauseOrEnd, true);
      document.removeEventListener("ended", onPauseOrEnd, true);
    };
  }, []);

  // Keep messagesRef in sync for background-session tracking (avoids stale closure).
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const prevId = activeIdRef.current;
    // Only abort/reset when the user explicitly switches between sessions.
    // If prevId is null (no previous session), we may be creating a new session to send
    // the first message immediately — aborting in that case kills the in-flight request.
    const isSwitching = prevId !== null && prevId !== activeId;
    if (isSwitching) {
      if (abortRef.current) {
        const prevCount = messagesRef.current.length;
        backgroundSessionsRef.current.set(prevId, prevCount);
        setBackgroundSessionIds((prev) => new Set([...prev, prevId]));
        abortRef.current.abort();
        abortRef.current = null;
      }
      setLoading(false);
      setStreamingText(null);
      setStreamingPhase(null);
    }
    activeIdRef.current = activeId;
    if (activeId) refreshMessagesAndCheckProcessing(activeId).catch((e) => setErr(String(e)));
    else setMessages([]);
  }, [activeId]);

  // Polling: watch background sessions and detect when their backend turn completes.
  const pollBackground = useCallback(async () => {
    if (backgroundSessionsRef.current.size === 0) return;
    for (const [sid, prevCount] of backgroundSessionsRef.current) {
      try {
        const msgs = await api.listMessages(sid);
        if (msgs.length > prevCount) {
          backgroundSessionsRef.current.delete(sid);
          setBackgroundSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(sid);
            return next;
          });
          // If this was the active session, update messages and stop loader.
          if (activeIdRef.current === sid) {
            setMessages(msgs);
            setLoading(false);
            setStreamingPhase(null);
          }
          refreshSessions().catch(() => undefined);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (backgroundSessionIds.size === 0) return;
    const interval = setInterval(pollBackground, 3000);
    return () => clearInterval(interval);
  }, [backgroundSessionIds.size, pollBackground]);

  async function handleNewSession() {
    const s = await api.createSession({ title: t("session.newTitle") });
    await refreshSessions();
    setActiveId(s.id);
    return s.id;
  }

  async function ensureSession(): Promise<string | null> {
    if (activeId) return activeId;
    try {
      return await handleNewSession();
    } catch (e: any) {
      setErr(e.message);
      return null;
    }
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

  async function handleDeleteAllSessions() {
    await api.deleteAllSessions();
    setActiveId(null);
    setMessages([]);
    await refreshSessions();
  }

  async function handleSendText(content: string) {
    const sid = await ensureSession();
    if (!sid) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setStreamingText(null);
    setErr(null);
    try {
      // Optimistic user message
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp_${Date.now()}`,
          sessionId: sid,
          role: "user",
          content,
          inputType: "text",
          outputType: "none",
          createdAt: new Date().toISOString(),
        } as Message,
      ]);
      await api.sendTextStream(sid, content, ctrl.signal, {
        onToolStart: (d) => {
          if (activeIdRef.current !== sid) return;
          setStreamingPhase(d.displayName);
        },
        onToolEnd: () => {
          if (activeIdRef.current !== sid) return;
          setStreamingPhase(null);
        },
        onToken: (token) => {
          if (activeIdRef.current !== sid) return;
          setStreamingPhase(null);
          setStreamingText((prev) => (prev ?? "") + token);
        },
        onDone: async () => {
          if (activeIdRef.current !== sid) return;
          setStreamingText(null);
          setStreamingPhase(null);
          await refreshMessages(sid);
          await refreshSessions();
        },
      });
    } catch (e: any) {
      setStreamingText(null);
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  }

  async function handleSendVoice(blob: Blob) {
    const sid = await ensureSession();
    if (!sid) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setErr(null);
    try {
      // 1) Transcribe first so the user sees their question immediately
      const tr = await api.transcribeVoice(sid, blob, ctrl.signal);
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp_voice_${Date.now()}`,
          sessionId: sid,
          role: "user",
          content: tr.transcript,
          inputType: "voice",
          outputType: "none",
          audioUrl: tr.audioUrl,
          createdAt: new Date().toISOString(),
        } as Message,
      ]);

      // 2) Run the AI turn with that transcript
      const r = await api.runVoice(sid, tr.transcript, tr.audioUrl, ctrl.signal);
      if (activeIdRef.current === sid) {
        await refreshMessages(sid);
        await refreshSessions();
        const url = audioUrl(r.audioUrl);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => undefined);
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          sidebarOpen ? "w-[260px]" : "w-0"
        )}
      >
        <SessionSidebar
          sessions={sessions}
          activeId={activeId}
          processingIds={backgroundSessionIds}
          onSelect={setActiveId}
          onNew={handleNewSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
          onDeleteAll={handleDeleteAllSessions}
        />
      </div>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <h2 className="truncate text-sm font-semibold">
              {sessions.find((s) => s.id === activeId)?.title || t("header.noSession")}
            </h2>
          </div>
        </header>

        {err && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive sm:px-6">
            {err}
          </div>
        )}

        <MessageList messages={messages} loading={loading} streamingText={streamingText} streamingPhase={streamingPhase} />
        <MessageInput
          disabled={loading}
          loading={loading}
          audioPlaying={audioPlaying}
          onSendText={handleSendText}
          onSendVoice={handleSendVoice}
          onStop={handleStop}
          onMuteAudio={stopAllAudio}
        />
        <audio ref={audioRef} hidden>
          <track kind="captions" />
        </audio>
      </main>
    </div>
  );
}
