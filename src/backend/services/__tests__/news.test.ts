import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/client', () => ({
  db: {
    company: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: 'c1' }), update: vi.fn() },
    article: { createMany: vi.fn() },
  },
}))

vi.mock('../../adapters/newsdata', () => ({
  fetchNewsData: vi.fn(),
}))

vi.mock('../../adapters/exa', () => ({
  fetchExaNews: vi.fn(),
}))

vi.mock('../../adapters/llm', () => ({
  classifySentiment: vi.fn().mockResolvedValue([
    { sentiment: 'neutral', isBreaking: false, summary: 'test' },
  ]),
}))

// Mock sleep to be instant for fast tests
vi.mock('../../utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}))

import { fetchNewsForCompany, fetchNewsForAllCompanies } from '../news'
import { db } from '../../db/client'
import { fetchNewsData } from '../../adapters/newsdata'
import { classifySentiment } from '../../adapters/llm'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: classify returns one result per article
  vi.mocked(classifySentiment).mockImplementation(async (titles: string[]) =>
    titles.map(() => ({ sentiment: 'neutral' as const, isBreaking: false, summary: 'test summary' }))
  )
  // Default: createMany returns count matching data length
  vi.mocked(db.article.createMany).mockImplementation(async (args: { data: unknown[]; skipDuplicates?: boolean }) => {
    return { count: Array.isArray(args.data) ? args.data.length : 0 } as never
  })
})

describe('fetchNewsForCompany', () => {
  it('inserts articles with sentiment and updates lastFetchedAt', async () => {
    vi.mocked(fetchNewsData).mockResolvedValue([
      { title: 'Coinbase Q1 earnings report', url: 'https://example.com/1', source: 'Bloomberg', publishedAt: new Date() },
      { title: 'Coinbase launches new product', url: 'https://example.com/2', source: 'Reuters', publishedAt: new Date() },
    ])
    vi.mocked(db.company.update).mockResolvedValue({} as never)

    const count = await fetchNewsForCompany('c1', 'Coinbase')
    expect(count).toBe(2)
    expect(db.article.createMany).toHaveBeenCalledTimes(1)
    const call = vi.mocked(db.article.createMany).mock.calls[0][0] as { data: Record<string, unknown>[]; skipDuplicates: boolean }
    expect(call.skipDuplicates).toBe(true)
    expect(call.data).toHaveLength(2)
    expect(call.data[0]).toHaveProperty('sentiment', 'neutral')
    expect(call.data[0]).toHaveProperty('isBreaking', false)
    expect(db.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastFetchedAt: expect.any(Date) },
    })
  })

  it('calls classifySentiment with article titles', async () => {
    vi.mocked(fetchNewsData).mockResolvedValue([
      { title: 'Coinbase Earnings Beat', url: 'https://example.com/1', source: 'X', publishedAt: new Date() },
    ])
    vi.mocked(db.company.update).mockResolvedValue({} as never)

    await fetchNewsForCompany('c1', 'Coinbase')
    expect(classifySentiment).toHaveBeenCalledWith(['Coinbase Earnings Beat'], 'Coinbase', 'Technology')
  })

  it('handles duplicates via skipDuplicates', async () => {
    vi.mocked(fetchNewsData).mockResolvedValue([
      { title: 'Coinbase Dup', url: 'https://example.com/dup', source: 'X', publishedAt: null },
    ])
    vi.mocked(db.article.createMany).mockResolvedValue({ count: 0 } as never)
    vi.mocked(db.company.update).mockResolvedValue({} as never)

    const count = await fetchNewsForCompany('c1', 'Coinbase')
    expect(count).toBe(0)
  })

  it('returns 0 when API returns no articles', async () => {
    vi.mocked(fetchNewsData).mockResolvedValue([])

    const count = await fetchNewsForCompany('c1', 'Coinbase')
    expect(count).toBe(0)
  })

  it('filters out blocklisted articles', async () => {
    vi.mocked(fetchNewsData).mockResolvedValue([
      { title: 'Coinbase launches new feature', url: 'https://example.com/1', source: 'X', publishedAt: new Date() },
      { title: 'Jobs at Coinbase', url: 'https://greenhouse.io/coinbase', source: 'Y', publishedAt: new Date() },
    ])
    vi.mocked(db.company.update).mockResolvedValue({} as never)

    const count = await fetchNewsForCompany('c1', 'Coinbase')
    // Only the news article passes — greenhouse.io job board URL is blocklisted
    const call = vi.mocked(db.article.createMany).mock.calls[0][0] as { data: Record<string, unknown>[] }
    expect(call.data).toHaveLength(1)
  })
})

describe('fetchNewsForAllCompanies', () => {
  it('skips companies fetched within 6 hours', async () => {
    const recentCompany = {
      id: 'c1',
      name: 'Recent',
      lastFetchedAt: new Date(),
    }
    vi.mocked(db.company.findMany).mockResolvedValue([recentCompany] as never)

    const result = await fetchNewsForAllCompanies()
    expect(result.total).toBe(0)
    expect(fetchNewsData).not.toHaveBeenCalled()
  })

  it('fetches news for companies not recently fetched', async () => {
    const staleCompany = {
      id: 'c2',
      name: 'Coinbase',
      keywords: null,
      sector: 'crypto',
      lastFetchedAt: new Date(Date.now() - 7 * 3_600_000),
    }
    vi.mocked(db.company.findMany).mockResolvedValue([staleCompany] as never)
    vi.mocked(fetchNewsData).mockResolvedValue([
      { title: 'Coinbase launches major product update', url: 'https://example.com/a', source: 'X', publishedAt: new Date() },
    ])
    vi.mocked(db.company.update).mockResolvedValue({} as never)

    const result = await fetchNewsForAllCompanies()
    expect(result.total).toBe(1)
    expect(result.perCompany['Coinbase']).toBe(1)
  })

  it('handles per-company errors gracefully', async () => {
    const company = { id: 'c3', name: 'Failing', lastFetchedAt: null }
    vi.mocked(db.company.findMany).mockResolvedValue([company] as never)
    vi.mocked(fetchNewsData).mockRejectedValue(new Error('API down'))

    const result = await fetchNewsForAllCompanies()
    expect(result.total).toBe(0)
    expect(result.perCompany['Failing']).toBe(0)
  })
})
