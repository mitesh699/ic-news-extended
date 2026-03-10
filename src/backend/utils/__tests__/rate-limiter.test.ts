import { describe, it, expect, vi } from 'vitest'
import { processWithDelay, NEWS_DELAY_MS, LLM_DELAY_MS } from '../rate-limiter'

describe('processWithDelay', () => {
  it('calls fn for each item in order', async () => {
    const results: number[] = []
    await processWithDelay([1, 2, 3], async (n) => {
      results.push(n)
    }, 0)
    expect(results).toEqual([1, 2, 3])
  })

  it('processes empty array without error', async () => {
    const fn = vi.fn()
    await processWithDelay([], fn, 100)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('rate limit constants', () => {
  it('NEWS_DELAY_MS is 2 seconds', () => {
    expect(NEWS_DELAY_MS).toBe(2_000)
  })

  it('LLM_DELAY_MS is 1.5 seconds', () => {
    expect(LLM_DELAY_MS).toBe(1_500)
  })
})
