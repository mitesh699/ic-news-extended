import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/client', () => ({
  db: {
    company: { findUnique: vi.fn(), findMany: vi.fn() },
    article: { count: vi.fn(), findMany: vi.fn() },
    summary: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../../adapters/llm', () => ({
  generateSummary: vi.fn(),
}))

import { generateSummaryForCompany, generateSummariesForAll } from '../summaries'
import { db } from '../../db/client'
import { generateSummary } from '../../adapters/llm'

beforeEach(() => {
  vi.clearAllMocks()
})

const mockCompany = { id: 'c1', name: 'Coinbase', description: 'Crypto exchange' }
const mockArticles = [
  { id: 'a1', title: 'Earnings', source: 'Bloomberg', publishedAt: new Date(), companyId: 'c1', url: 'u', urlHash: 'h', fetchedAt: new Date(), sentiment: 'positive', isBreaking: false },
]

const mockStructuredSummary = {
  summary: 'Strong Q1 results.',
  keyThemes: ['earnings', 'growth'],
  outlook: 'positive' as const,
  actionItems: [],
}

describe('generateSummaryForCompany', () => {
  it('generates summary when new articles exist', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as never)
    vi.mocked(db.summary.findFirst).mockResolvedValue(null)
    vi.mocked(db.article.count).mockResolvedValue(1)
    vi.mocked(db.article.findMany).mockResolvedValue(mockArticles as never)
    vi.mocked(generateSummary).mockResolvedValue(mockStructuredSummary)
    vi.mocked(db.summary.create).mockResolvedValue({} as never)

    const result = await generateSummaryForCompany('c1')
    expect(result).toBe(true)
    expect(db.summary.create).toHaveBeenCalledWith({
      data: {
        companyId: 'c1',
        summaryText: 'Strong Q1 results.',
        promptVersion: 'v2',
        articleCount: 1,
        metadata: JSON.stringify({
          keyThemes: ['earnings', 'growth'],
          outlook: 'positive',
          actionItems: [],
        }),
      },
    })
  })

  it('skips when company not found', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(null)

    const result = await generateSummaryForCompany('missing')
    expect(result).toBe(false)
  })

  it('skips when no new articles since last summary', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as never)
    vi.mocked(db.summary.findFirst).mockResolvedValue({
      id: 's1',
      generatedAt: new Date(),
    } as never)
    vi.mocked(db.article.count).mockResolvedValue(0)

    const result = await generateSummaryForCompany('c1')
    expect(result).toBe(false)
    expect(generateSummary).not.toHaveBeenCalled()
  })

  it('skips when no articles at all', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as never)
    vi.mocked(db.summary.findFirst).mockResolvedValue(null)
    vi.mocked(db.article.count).mockResolvedValue(0)
    vi.mocked(db.article.findMany).mockResolvedValue([])

    const result = await generateSummaryForCompany('c1')
    expect(result).toBe(false)
  })

  it('returns false when LLM returns null', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(mockCompany as never)
    vi.mocked(db.summary.findFirst).mockResolvedValue(null)
    vi.mocked(db.article.count).mockResolvedValue(1)
    vi.mocked(db.article.findMany).mockResolvedValue(mockArticles as never)
    vi.mocked(generateSummary).mockResolvedValue(null)

    const result = await generateSummaryForCompany('c1')
    expect(result).toBe(false)
    expect(db.summary.create).not.toHaveBeenCalled()
  })
})

describe('generateSummariesForAll', () => {
  it('counts generated and skipped summaries', async () => {
    vi.mocked(db.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'A' },
      { id: 'c2', name: 'B' },
    ] as never)

    vi.mocked(db.company.findUnique)
      .mockResolvedValueOnce({ id: 'c1', name: 'A', description: '' } as never)
      .mockResolvedValueOnce({ id: 'c2', name: 'B', description: '' } as never)
    vi.mocked(db.summary.findFirst).mockResolvedValue(null)
    vi.mocked(db.article.count).mockResolvedValue(1)
    vi.mocked(db.article.findMany).mockResolvedValue(mockArticles as never)
    vi.mocked(generateSummary)
      .mockResolvedValueOnce(mockStructuredSummary)
      .mockResolvedValueOnce(null)
    vi.mocked(db.summary.create).mockResolvedValue({} as never)

    const result = await generateSummariesForAll()
    expect(result.generated).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
