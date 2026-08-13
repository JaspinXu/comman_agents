import type { Agent, ChatMessage, EnsembleLine, Health, RunEvent } from "./types";

export function apiBase(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  return `http://${window.location.hostname}:8000`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? response.statusText ?? "请求失败");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const studioApi = {
  bootstrap: () => Promise.all([
    request<Health>("/api/health"),
    request<Agent[]>("/api/agents"),
  ]),
  createAgent: (agent: Agent) => request<Agent>("/api/agents", {
    method: "POST", headers: jsonHeaders, body: JSON.stringify(agent),
  }),
  updateAgent: (agent: Agent) => request<Agent>(`/api/agents/${agent.id}`, {
    method: "PUT", headers: jsonHeaders, body: JSON.stringify(agent),
  }),
  deleteAgent: (agentId: string) => request<void>(`/api/agents/${agentId}`, { method: "DELETE" }),
  generatePortrait: (agentId: string) => request<Agent>(`/api/agents/${agentId}/portrait`, { method: "POST" }),
  chat: (agentId: string, message: string, history: ChatMessage[]) => request<{ reply: string }>(`/api/agents/${agentId}/chat`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ message, history }),
  }),
  async runEnsemble(
    background: string,
    prompt: string,
    agentIds: string[],
    history: EnsembleLine[],
    onEvent: (event: RunEvent) => void,
  ) {
    const response = await fetch(`${apiBase()}/api/runs`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ background, prompt, agent_ids: agentIds, history }),
    });
    if (!response.ok || !response.body) throw new Error(await response.text());
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as RunEvent);
      if (done) break;
    }
  },
};

export function portraitSource(agent: Agent): string {
  if (!agent.portraitUrl) return "";
  return agent.portraitUrl.startsWith("/api/") ? `${apiBase()}${agent.portraitUrl}` : agent.portraitUrl;
}
