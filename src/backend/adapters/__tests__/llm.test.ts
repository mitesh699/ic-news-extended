import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateSummary', () => {
  const input = {
    companyName: 'Coinbase',
    companyDescription: 'Crypto exchange',
    articles: [
      { title: 'Q1 Earnings', source: 'Bloomberg', publishedAt: new Date('2026-03-07') },
    ],
  }

  const structuredJson = JSON.stringify({
    summary: 'Strong Q1 results for Coinbase.',
    keyThemes: ['earnings'],
    outlook: 'positive',
    actionItems: [],
  })

  it('returns structured summary from Anthropic primary', async () => {
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: structuredJson }],
          }),
        }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: vi.fn() } }
      },
    }))

    const { generateSummary } = await import('../llm')
    const result = await generateSummary(input)
    expect(result).not.toBeNull()
    expect(result!.summary).toBe('Strong Q1 results for Coinbase.')
    expect(result!.outlook).toBe('positive')
    expect(result!.keyThemes).toContain('earnings')
  })

  it('returns null for empty articles', async () => {
    vi.resetModules()
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = { create: vi.fn() }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: vi.fn() } }
      },
    }))

    const { generateSummary } = await import('../llm')
    const result = await generateSummary({ ...input, articles: [] })
    expect(result).toBeNull()
  })

  it('falls back to OpenAI when Anthropic fails', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: vi.fn().mockRejectedValue(new Error('Anthropic down')),
        }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: structuredJson } }],
            }),
          },
        }
      },
    }))

    const { generateSummary } = await import('../llm')
    const result = await generateSummary(input)
    expect(result).not.toBeNull()
    expect(result!.summary).toBe('Strong Q1 results for Coinbase.')
  })

  it('returns null when both providers fail', async () => {
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: vi.fn().mockRejectedValue(new Error('Anthropic down')),
        }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('OpenAI down')),
          },
        }
      },
    }))

    const { generateSummary } = await import('../llm')
    const result = await generateSummary(input)
    expect(result).toBeNull()
  })
})

describe('classifySentiment', () => {
  it('classifies article titles', async () => {
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: vi.fn().mockResolvedValue({
            content: [{
              type: 'text',
              text: JSON.stringify([
                { sentiment: 'positive', isBreaking: false },
                { sentiment: 'negative', isBreaking: true },
              ]),
            }],
          }),
        }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: vi.fn() } }
      },
    }))

    const { classifySentiment } = await import('../llm')
    const results = await classifySentiment(['Great earnings', 'Massive layoffs'])
    expect(results).toHaveLength(2)
    expect(results[0].sentiment).toBe('positive')
    expect(results[1].isBreaking).toBe(true)
  })

  it('returns neutral fallback on error', async () => {
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = {
          create: vi.fn().mockRejectedValue(new Error('API down')),
        }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: vi.fn() } }
      },
    }))

    const { classifySentiment } = await import('../llm')
    const results = await classifySentiment(['Article 1'])
    expect(results).toHaveLength(1)
    expect(results[0].sentiment).toBe('neutral')
    expect(results[0].isBreaking).toBe(false)
  })

  it('returns empty array for empty input', async () => {
    vi.resetModules()

    vi.doMock('@anthropic-ai/sdk', () => ({
      default: class {
        messages = { create: vi.fn() }
      },
    }))
    vi.doMock('openai', () => ({
      default: class {
        chat = { completions: { create: vi.fn() } }
      },
    }))

    const { classifySentiment } = await import('../llm')
    const results = await classifySentiment([])
    expect(results).toEqual([])
  })
})
