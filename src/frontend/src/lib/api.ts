import type { Company, Competitor, SectorBrief } from "@/types/company";
import { API_BASE_URL } from "@/lib/constants";

export async function fetchCompanies(): Promise<Company[]> {
  const res = await fetch(`${API_BASE_URL}/companies`);
  if (!res.ok) throw new Error("Failed to fetch companies");
  return res.json();
}

export async function refreshNews(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Refresh failed (${res.status})`);
  }
}

export interface ChatResponse {
  response: string;
  followUps?: string[];
}

export async function sendChatMessage(
  message: string,
  companyId?: string,
  history?: { role: "user" | "assistant"; content: string }[],
  agentMode?: boolean
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, companyId, history, agentMode }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

// Streaming chat (agent mode)
export interface StreamCallbacks {
  onToken: (text: string) => void;
  onToolCall: (toolName: string) => void;
  onToolResult: (toolName: string) => void;
  onDone: (followUps: string[]) => void;
  onError: (error: string) => void;
}

export async function streamChatMessage(
  message: string,
  callbacks: StreamCallbacks,
  history?: { role: "user" | "assistant"; content: string }[],
  companyId?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, companyId, history }),
  });

  if (!res.ok) {
    callbacks.onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === "text-delta" && data.text) {
              callbacks.onToken(data.text);
            } else if (currentEvent === "tool-call" && data.toolName) {
              callbacks.onToolCall(data.toolName);
            } else if (currentEvent === "tool-result" && data.toolName) {
              callbacks.onToolResult(data.toolName);
            } else if (currentEvent === "done") {
              callbacks.onDone(data.followUps || []);
            } else if (currentEvent === "error") {
              callbacks.onError(data.error || "Stream error");
            }
          } catch { /* skip malformed */ }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Newsletter
export async function subscribeNewsletter(
  email: string,
  frequency: "daily" | "weekly" = "daily"
): Promise<{ subscribed: boolean }> {
  const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, frequency }),
  });
  if (!res.ok) throw new Error("Subscribe failed");
  return res.json();
}

// Competitors
export async function fetchCompetitors(companyId: string): Promise<Competitor[]> {
  const res = await fetch(`${API_BASE_URL}/companies/${companyId}/competitors`);
  if (!res.ok) throw new Error("Failed to fetch competitors");
  return res.json();
}

// Sectors
export async function fetchSectors(): Promise<SectorBrief[]> {
  const res = await fetch(`${API_BASE_URL}/sectors`);
  if (!res.ok) throw new Error("Failed to fetch sectors");
  return res.json();
}

export async function fetchSectorBrief(sector: string): Promise<SectorBrief> {
  const res = await fetch(`${API_BASE_URL}/sectors/${encodeURIComponent(sector)}`);
  if (!res.ok) throw new Error("Failed to fetch sector brief");
  return res.json();
}
