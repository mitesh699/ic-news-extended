import { describe, it, expect } from 'vitest'
import { BATCH_DELAY_MS, LLM_BATCH_DELAY_MS } from '../rate-limiter'

describe('rate limit constants', () => {
  it('BATCH_DELAY_MS is 2 seconds', () => {
    expect(BATCH_DELAY_MS).toBe(2_000)
  })

  it('LLM_BATCH_DELAY_MS is 2 seconds', () => {
    expect(LLM_BATCH_DELAY_MS).toBe(2_000)
  })
})
