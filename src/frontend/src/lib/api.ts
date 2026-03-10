import type { Company } from "@/types/company";

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

export async function sendChatMessage(
  message: string,
  companyId?: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, companyId }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  const data = await res.json();
  return data.response;
}
