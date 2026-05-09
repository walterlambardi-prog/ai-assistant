import type { Message, Session, Tool } from "./types";

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
  createSession: (data: Partial<Session>) =>
    jsonFetch<Session>("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
  getSession: (id: string) => jsonFetch<Session>(`/api/sessions/${id}`),
  updateSession: (id: string, data: Partial<Session>) =>
    jsonFetch<Session>(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSession: (id: string) =>
    jsonFetch<void>(`/api/sessions/${id}`, { method: "DELETE" }),

  // Messages
  listMessages: (sessionId: string) =>
    jsonFetch<Message[]>(`/api/sessions/${sessionId}/messages`),
  sendText: (sessionId: string, content: string) =>
    jsonFetch<{ assistantMessageId: string; content: string; toolCalls: any[] }>(
      `/api/sessions/${sessionId}/messages/text`,
      { method: "POST", body: JSON.stringify({ content }) }
    ),
  sendVoice: async (sessionId: string, audio: Blob) => {
    const fd = new FormData();
    fd.append("audio", audio, "voice.webm");
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages/voice`, {
      method: "POST",
      body: fd,
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
};

export function audioUrl(rel: string | null | undefined): string | null {
  if (!rel) return null;
  return `${API_BASE}/${rel}`;
}
