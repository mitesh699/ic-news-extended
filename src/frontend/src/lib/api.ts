import type { Company, Competitor, SectorBrief } from "@/types/company";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

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
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, companyId, history }),
  });
  if (!res.ok) throw new Error("Chat request failed");
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
