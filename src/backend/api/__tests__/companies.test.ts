import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// Mock the db client before importing companies
vi.mock('../../db/client', () => ({
  db: {
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import companies from '../companies'
import { db } from '../../db/client'

const app = new Hono()
app.route('/api/companies', companies)

const mockCompany = {
  id: 'cuid_1',
  name: 'Coinbase',
  logoUrl: 'https://logo.clearbit.com/coinbase.com',
  sector: 'Crypto',
  description: 'Cryptocurrency exchange',
  website: 'https://coinbase.com',
  scrapedAt: new Date(),
  lastFetchedAt: new Date('2026-03-08T10:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
  articles: [
    {
      id: 'art_1',
      title: 'Coinbase Q1 Earnings Beat',
      source: 'Bloomberg',
      url: 'https://example.com/1',
      publishedAt: new Date('2026-03-07'),
      companyId: 'cuid_1',
      urlHash: 'abc123',
      fetchedAt: new Date(),
    },
  ],
  summaries: [
    {
      id: 'sum_1',
      companyId: 'cuid_1',
      summaryText: 'Coinbase reported strong Q1 earnings.',
      promptVersion: 'v1',
      articleCount: 1,
      generatedAt: new Date(),
    },
  ],
}

// Clear cache between tests
vi.mock('../../utils/cache', () => ({
  cache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/companies', () => {
  it('returns list of companies with articles and summaries', async () => {
    vi.mocked(db.company.findMany).mockResolvedValue([mockCompany] as never)

    const res = await app.request('/api/companies')
    expect(res.status).toBe(200)

    const body = await res.json() as Record<string, unknown>[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('cuid_1')
    expect(body[0].name).toBe('Coinbase')
    expect(body[0].sector).toBe('Crypto')
    expect(body[0].summary).toBe('Coinbase reported strong Q1 earnings.')
    expect(body[0].newsArticles).toHaveLength(1)
    expect((body[0].newsArticles as Record<string, unknown>[])[0].title).toBe('Coinbase Q1 Earnings Beat')
  })

  it('returns empty array when no companies exist', async () => {
    vi.mocked(db.company.findMany).mockResolvedValue([])

    const res = await app.request('/api/companies')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('filters companies by search query', async () => {
    vi.mocked(db.company.findMany).mockResolvedValue([mockCompany] as never)

    const res = await app.request('/api/companies?search=coin')
    expect(res.status).toBe(200)

    const call = vi.mocked(db.company.findMany).mock.calls[0][0]
    expect(call?.where).toEqual({
      name: { contains: 'coin', mode: 'insensitive' },
    })
  })

  it('handles company with no summaries gracefully', async () => {
    const noSummary = { ...mockCompany, summaries: [] }
    vi.mocked(db.company.findMany).mockResolvedValue([noSummary] as never)

    const res = await app.request('/api/companies')
    const body = await res.json() as Record<string, unknown>[]
    expect(body[0].summary).toBe('')
  })

  it('handles company with null lastFetchedAt', async () => {
    const noFetch = { ...mockCompany, lastFetchedAt: null }
    vi.mocked(db.company.findMany).mockResolvedValue([noFetch] as never)

    const res = await app.request('/api/companies')
    const body = await res.json() as Record<string, unknown>[]
    expect(body[0].lastUpdated).toBeDefined()
  })
})

describe('GET /api/companies/:id', () => {
  it('returns a single company by ID', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as never)

    const res = await app.request('/api/companies/clh1234567890abcdef12345')
    expect(res.status).toBe(200)

    const body = await res.json() as Record<string, unknown>
    expect(body.id).toBe('cuid_1')
    expect(body.name).toBe('Coinbase')
  })

  it('returns 400 for invalid company ID format', async () => {
    const res = await app.request('/api/companies/not-a-cuid')
    expect(res.status).toBe(400)

    const body = await res.json() as Record<string, unknown>
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent company', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(null)

    const res = await app.request('/api/companies/clh1234567890abcdef12345')
    expect(res.status).toBe(404)

    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Company not found')
    expect(body.code).toBe('NOT_FOUND')
  })
})
