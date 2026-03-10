import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.mock('../../db/client', () => ({
  db: {
    article: { findMany: vi.fn() },
    summary: { findMany: vi.fn() },
    company: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Coinbase reported strong Q1 earnings.' }],
        }),
      }
    },
  }
})

import chat from '../chat'
import { db } from '../../db/client'

const app = new Hono()
app.route('/api/chat', chat)

// Valid CUID for test (matches z.string().cuid() validation)
const VALID_CUID = 'clh1234567890abcdef12345'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.company.findMany).mockResolvedValue([
    { name: 'Coinbase', sector: 'Crypto' },
  ] as never)
  vi.mocked(db.article.findMany).mockResolvedValue([
    {
      id: 'art_1',
      title: 'Coinbase Q1',
      source: 'Bloomberg',
      url: 'https://example.com',
      publishedAt: new Date(),
      companyId: VALID_CUID,
      urlHash: 'h1',
      fetchedAt: new Date(),
      company: { name: 'Coinbase' },
    },
  ] as never)
  vi.mocked(db.summary.findMany).mockResolvedValue([
    {
      id: 's1',
      companyId: VALID_CUID,
      summaryText: 'Strong earnings.',
      promptVersion: 'v1',
      articleCount: 1,
      generatedAt: new Date(),
      company: { name: 'Coinbase' },
    },
  ] as never)
})

describe('POST /api/chat', () => {
  it('returns AI response for valid message', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tell me about Coinbase' }),
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.response).toBe('Coinbase reported strong Q1 earnings.')
  })

  it('returns 400 for missing message', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for empty message', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('filters articles by companyId when provided', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Latest news', companyId: VALID_CUID }),
    })
    expect(res.status).toBe(200)

    const articleCall = vi.mocked(db.article.findMany).mock.calls[0][0]
    expect(articleCall?.where).toEqual({ companyId: VALID_CUID })
  })

  it('returns 400 for invalid companyId format', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', companyId: 'not-a-cuid' }),
    })
    expect(res.status).toBe(400)
  })
})
