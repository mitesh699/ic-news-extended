import { describe, it, expect, vi, afterEach } from 'vitest'
import { Hono } from 'hono'
import { rateLimiter } from '../rate-limit'

afterEach(() => {
  vi.useRealTimers()
})

function buildApp(opts: { windowMs: number; max: number }) {
  const app = new Hono()
  app.use('*', rateLimiter(opts))
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

describe('rateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp({ windowMs: 60_000, max: 3 })

    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2')
  })

  it('returns 429 when limit exceeded', async () => {
    const app = buildApp({ windowMs: 60_000, max: 2 })

    await app.request('/') // 1
    await app.request('/') // 2
    const res = await app.request('/') // 3 → over limit

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
  })

  it('sets rate limit headers', async () => {
    const app = buildApp({ windowMs: 60_000, max: 10 })

    const res = await app.request('/')
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
  })
})
