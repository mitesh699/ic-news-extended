/**
 * Simple serial queue with delay between calls.
 * Avoids ESM-only p-queue dependency.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function processWithDelay<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  delayMs: number
): Promise<void> {
  for (const item of items) {
    await fn(item)
    await sleep(delayMs)
  }
}

// Delay between batches of concurrent requests
export const NEWS_DELAY_MS = 2_000

// LLM calls: ~40 RPM → 1.5s between calls
export const LLM_DELAY_MS = 1_500
