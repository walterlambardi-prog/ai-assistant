import type { Message, Session, Tool, AppConfig, OllamaModel } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  // Sessions
  listSessions: () => jsonFetch<Session[]>("/api/sessions"),
  searchSessions: (q: string) =>
    jsonFetch<Session[]>(`/api/sessions/search?q=${encodeURIComponent(q)}`),
  createSession: (data: Partial<Session>) =>
    jsonFetch<Session>("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
  getSession: (id: string) => jsonFetch<Session>(`/api/sessions/${id}`),
  updateSession: (id: string, data: Partial<Session>) =>
    jsonFetch<Session>(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSession: (id: string) =>
    jsonFetch<void>(`/api/sessions/${id}`, { method: "DELETE" }),
  deleteAllSessions: () =>
    jsonFetch<void>("/api/sessions", { method: "DELETE" }),
  cancelLast: (id: string) =>
    jsonFetch<{ cancelled: string[] }>(`/api/sessions/${id}/cancel-last`, { method: "POST" }),
  cancelSession: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/sessions/${id}/cancel`, { method: "POST" }),

  // Messages
  listMessages: (sessionId: string) =>
    jsonFetch<Message[]>(`/api/sessions/${sessionId}/messages`),
  sendText: (sessionId: string, content: string, signal?: AbortSignal) =>
    jsonFetch<{ assistantMessageId: string; content: string; toolCalls: any[] }>(
      `/api/sessions/${sessionId}/messages/text`,
      { method: "POST", body: JSON.stringify({ content }), signal }
    ),
  sendTextStream: async (
    sessionId: string,
    content: string,
    signal: AbortSignal,
    callbacks: {
      onToolStart?: (data: { name: string; displayName: string; args: unknown }) => void;
      onToolEnd?: (data: { name: string; displayName: string; ok: boolean; durationMs: number }) => void;
      onToken: (text: string) => void;
      onDone: (data: { assistantMessageId: string; toolCalls: any[] }) => void;
    }
  ): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages/text/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status}: ${text}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (event === "token") callbacks.onToken(parsed.text ?? "");
          else if (event === "tool_start") callbacks.onToolStart?.(parsed);
          else if (event === "tool_end") callbacks.onToolEnd?.(parsed);
          else if (event === "done") callbacks.onDone(parsed);
        } catch { /* ignore malformed */ }
      }
    }
  },
  sendVoice: async (sessionId: string, audio: Blob, signal?: AbortSignal) => {
    const fd = new FormData();
    fd.append("audio", audio, "voice.webm");
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages/voice`, {
      method: "POST",
      body: fd,
      signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return (await res.json()) as {
      transcript: string;
      content: string;
      audioUrl: string | null;
      assistantMessageId: string;
      toolCalls: any[];
    };
  },
  transcribeVoice: async (sessionId: string, audio: Blob, signal?: AbortSignal) => {
    const fd = new FormData();
    fd.append("audio", audio, "voice.webm");
    const res = await fetch(
      `${API_BASE}/api/sessions/${sessionId}/messages/voice/transcribe`,
      { method: "POST", body: fd, signal }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return (await res.json()) as { transcript: string; audioUrl: string };
  },
  runVoice: (
    sessionId: string,
    transcript: string,
    audioUrl: string | null,
    signal?: AbortSignal
  ) =>
    jsonFetch<{
      transcript: string;
      content: string;
      audioUrl: string | null;
      assistantMessageId: string;
      toolCalls: any[];
    }>(`/api/sessions/${sessionId}/messages/voice/run`, {
      method: "POST",
      body: JSON.stringify({ transcript, audioUrl }),
      signal,
    }),

  // Tools
  listTools: () => jsonFetch<Tool[]>("/api/tools"),
  getTool: (id: string) => jsonFetch<Tool>(`/api/tools/${id}`),
  createTool: (data: Partial<Tool>) =>
    jsonFetch<Tool>("/api/tools", { method: "POST", body: JSON.stringify(data) }),
  updateTool: (id: string, data: Partial<Tool>) =>
    jsonFetch<Tool>(`/api/tools/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTool: (id: string) =>
    jsonFetch<void>(`/api/tools/${id}`, { method: "DELETE" }),
  testTool: (id: string, args: Record<string, unknown>) =>
    jsonFetch<any>(`/api/tools/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ args }),
    }),

  // Config
  getConfig: () => jsonFetch<AppConfig>("/api/config"),
  updateConfig: (data: Partial<AppConfig>) =>
    jsonFetch<AppConfig>("/api/config", { method: "PATCH", body: JSON.stringify(data) }),
  listOllamaModels: () =>
    jsonFetch<{ models: OllamaModel[] }>("/api/config/ollama/models"),
  listTtsVoices: () =>
    jsonFetch<{ voices: { name: string; locale: string; sample: string }[] }>(
      "/api/config/tts/voices"
    ),
  previewTtsVoice: (data: {
    voice?: string | null;
    rate?: number | null;
    language?: "en" | "es";
    text?: string;
  }) =>
    jsonFetch<{ url: string; text: string }>("/api/config/tts/preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export function audioUrl(rel: string | null | undefined): string | null {
  if (!rel) return null;
  return `${API_BASE}/${rel}`;
}
