export type Role = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  id?: string;
  role: Role;
  content: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
};
