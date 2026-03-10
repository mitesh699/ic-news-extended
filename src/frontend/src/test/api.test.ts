import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCompanies, refreshNews, sendChatMessage } from "@/lib/api";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchCompanies", () => {
  it("fetches and returns companies", async () => {
    const companies = [{ id: "1", name: "Coinbase" }];
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(companies) });

    const result = await fetchCompanies();
    expect(result).toEqual(companies);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/companies"));
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchCompanies()).rejects.toThrow("Failed to fetch companies");
  });
});

describe("refreshNews", () => {
  it("sends POST request", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await refreshNews();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/refresh"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(refreshNews()).rejects.toThrow("Refresh failed");
  });
});

describe("sendChatMessage", () => {
  it("sends message and returns response text", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: "AI answer" }),
    });

    const result = await sendChatMessage("test question");
    expect(result).toBe("AI answer");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/chat"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test question" }),
      })
    );
  });

  it("includes companyId when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: "answer" }),
    });

    await sendChatMessage("question", "c1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ message: "question", companyId: "c1" }),
      })
    );
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(sendChatMessage("test")).rejects.toThrow("Chat request failed");
  });
});
