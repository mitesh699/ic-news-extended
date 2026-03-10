import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/client', () => ({
  db: {
    webhook: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '../../db/client'

// Must import after mocks
const { default: webhooks } = await import('../webhooks')

// Helper to make requests
function makeRequest(method: string, path: string, body?: Record<string, unknown>, headers?: Record<string, string>) {
  const url = `http://localhost${path}`
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) init.body = JSON.stringify(body)
  return webhooks.request(new Request(url, init))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('REFRESH_SECRET', 'test-secret-123')
})

describe('GET /api/webhooks', () => {
  it('returns 401 without auth token', async () => {
    const res = await makeRequest('GET', '/')
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong token', async () => {
    const res = await makeRequest('GET', '/', undefined, { 'X-Refresh-Token': 'wrong' })
    expect(res.status).toBe(401)
  })

  it('lists webhooks with valid token', async () => {
    vi.mocked(db.webhook.findMany).mockResolvedValue([
      { id: 'w1', url: 'https://example.com/hook', events: 'articles.new', active: true, createdAt: new Date() },
    ] as never)

    const res = await makeRequest('GET', '/', undefined, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].url).toBe('https://example.com/hook')
  })
})

describe('POST /api/webhooks', () => {
  it('returns 401 without auth', async () => {
    const res = await makeRequest('POST', '/', { url: 'https://example.com/hook' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid URL', async () => {
    const res = await makeRequest('POST', '/', { url: 'not-a-url' }, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate URL', async () => {
    vi.mocked(db.webhook.findUnique).mockResolvedValue({ id: 'existing' } as never)

    const res = await makeRequest('POST', '/', { url: 'https://example.com/hook' }, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(409)
  })

  it('creates webhook with valid data', async () => {
    vi.mocked(db.webhook.findUnique).mockResolvedValue(null)
    vi.mocked(db.webhook.create).mockResolvedValue({
      id: 'w1', url: 'https://example.com/hook', events: 'articles.new', active: true, createdAt: new Date(),
    } as never)

    const res = await makeRequest('POST', '/', { url: 'https://example.com/hook' }, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.url).toBe('https://example.com/hook')
  })
})

describe('DELETE /api/webhooks/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await makeRequest('DELETE', '/w1')
    expect(res.status).toBe(401)
  })

  it('deletes webhook', async () => {
    vi.mocked(db.webhook.delete).mockResolvedValue({} as never)

    const res = await makeRequest('DELETE', '/w1', undefined, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })

  it('returns 404 for non-existent webhook', async () => {
    vi.mocked(db.webhook.delete).mockRejectedValue(new Error('not found'))

    const res = await makeRequest('DELETE', '/nonexistent', undefined, { 'X-Refresh-Token': 'test-secret-123' })
    expect(res.status).toBe(404)
  })
})
