/**
 * Strips markdown code fences and parses JSON.
 * Handles ```json ... ``` wrapping common in LLM responses.
 */
export function stripMarkdownFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '').trim()
}

export function parseJsonResponse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(stripMarkdownFences(text)) as T
  } catch {
    return fallback
  }
}
