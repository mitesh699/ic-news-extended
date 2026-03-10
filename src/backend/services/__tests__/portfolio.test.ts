import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/client', () => ({
  db: {
    company: {
      upsert: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { upsertCompanies, getCompanyCount } from '../portfolio'
import { db } from '../../db/client'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('upsertCompanies', () => {
  it('upserts all companies and returns count', async () => {
    vi.mocked(db.company.upsert).mockResolvedValue({} as never)

    const count = await upsertCompanies([
      { name: 'Coinbase', sector: 'Crypto' },
      { name: 'Flexport', sector: 'Logistics' },
    ])

    expect(count).toBe(2)
    expect(db.company.upsert).toHaveBeenCalledTimes(2)
  })

  it('passes correct create/update data', async () => {
    vi.mocked(db.company.upsert).mockResolvedValue({} as never)

    await upsertCompanies([
      { name: 'Test', description: 'desc', website: 'https://test.com', sector: 'Tech', logoUrl: 'https://logo.png' },
    ])

    expect(db.company.upsert).toHaveBeenCalledWith({
      where: { name: 'Test' },
      update: {
        description: 'desc',
        website: 'https://test.com',
        sector: 'Tech',
        logoUrl: 'https://logo.png',
        keywords: null,
        scrapedAt: expect.any(Date),
      },
      create: {
        name: 'Test',
        description: 'desc',
        website: 'https://test.com',
        sector: 'Tech',
        logoUrl: 'https://logo.png',
        keywords: null,
      },
    })
  })

  it('returns 0 for empty array', async () => {
    const count = await upsertCompanies([])
    expect(count).toBe(0)
    expect(db.company.upsert).not.toHaveBeenCalled()
  })
})

describe('getCompanyCount', () => {
  it('returns count from database', async () => {
    vi.mocked(db.company.count).mockResolvedValue(30)
    const count = await getCompanyCount()
    expect(count).toBe(30)
  })
})
