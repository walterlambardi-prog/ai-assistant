export type Session = {
  id: string;
  title: string;
  model?: string | null;
  systemPrompt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  inputType: string;
  outputType: string;
  audioUrl?: string | null;
  toolName?: string | null;
  metadata?: string | null;
  createdAt: string;
};

export type Tool = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  usageGuidance: string;
  enabled: boolean;
  type: string;
  method: string;
  url: string;
  headers: string;
  queryParams: string;
  bodyTemplate: string;
  parameters: string;
  parameterPolicy: string;
  responseMapping: string;
  timeoutMs: number;
  maxResponseKb: number;
  allowedHosts: string;
  createdAt: string;
  updatedAt: string;
};
