import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'

const originalEnv = process.env

vi.mock('../../services/news', () => ({
  fetchNewsForAllCompanies: vi.fn(),
  fetchNewsForCompany: vi.fn(),
  parseKeywords: vi.fn().mockReturnValue([]),
}))

vi.mock('../../services/summaries', () => ({
  generateSummariesForAll: vi.fn(),
  generateSummaryForCompany: vi.fn(),
}))

vi.mock('../../db/client', () => ({
  db: {
    company: { findUnique: vi.fn() },
  },
}))

// Must mock node:crypto for timingSafeEqual
vi.mock('node:crypto', () => ({
  timingSafeEqual: (a: Buffer, b: Buffer) => a.equals(b),
}))

import refresh from '../refresh'
import { fetchNewsForAllCompanies, fetchNewsForCompany } from '../../services/news'
import { generateSummariesForAll, generateSummaryForCompany } from '../../services/summaries'
import { db } from '../../db/client'

const app = new Hono()
app.route('/api/refresh', refresh)

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...originalEnv, REFRESH_SECRET: 'test-secret' }
})

afterEach(() => {
  process.env = originalEnv
})

describe('POST /api/refresh', () => {
  it('accepts and starts pipeline in background with valid token', async () => {
    vi.mocked(fetchNewsForAllCompanies).mockResolvedValue({
      total: 5,
      perCompany: { Coinbase: 3, Flexport: 2 },
    })
    vi.mocked(generateSummariesForAll).mockResolvedValue({
      generated: 2,
      skipped: 0,
    })

    const res = await app.request('/api/refresh', {
      method: 'POST',
      headers: { 'X-Refresh-Token': 'test-secret' },
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('accepted')
    expect(body.message).toBeDefined()
  })

  it('returns 401 for missing/invalid token', async () => {
    const res = await app.request('/api/refresh', { method: 'POST' })
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 503 when REFRESH_SECRET is not configured', async () => {
    delete process.env.REFRESH_SECRET

    const res = await app.request('/api/refresh', { method: 'POST' })
    expect(res.status).toBe(503)

    const body = await res.json()
    expect(body.code).toBe('NOT_CONFIGURED')
  })

  it('returns accepted even if pipeline will fail (async)', async () => {
    vi.mocked(fetchNewsForAllCompanies).mockRejectedValue(new Error('DB down'))

    const res = await app.request('/api/refresh', {
      method: 'POST',
      headers: { 'X-Refresh-Token': 'test-secret' },
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('accepted')
  })
})

const VALID_CUID = 'clh1234567890abcdef12345'

describe('POST /api/refresh/:companyId', () => {
  it('refreshes a single company with valid token', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue({
      id: VALID_CUID,
      name: 'Coinbase',
      keywords: '["coinbase","COIN"]',
      sector: 'Crypto',
    } as never)
    vi.mocked(fetchNewsForCompany).mockResolvedValue(3)
    vi.mocked(generateSummaryForCompany).mockResolvedValue(true)

    const res = await app.request(`/api/refresh/${VALID_CUID}`, {
      method: 'POST',
      headers: { 'X-Refresh-Token': 'test-secret' },
    })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('complete')
    expect(body.company).toBe('Coinbase')
    expect(body.newArticles).toBe(3)
    expect(body.summaryGenerated).toBe(true)
  })

  it('returns 404 for unknown company', async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(null)

    const res = await app.request(`/api/refresh/${VALID_CUID}`, {
      method: 'POST',
      headers: { 'X-Refresh-Token': 'test-secret' },
    })
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('returns 401 without token', async () => {
    const res = await app.request(`/api/refresh/${VALID_CUID}`, {
      method: 'POST',
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid companyId format', async () => {
    const res = await app.request('/api/refresh/not-a-cuid', {
      method: 'POST',
      headers: { 'X-Refresh-Token': 'test-secret' },
    })
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})
