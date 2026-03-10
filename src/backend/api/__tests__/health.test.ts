import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import health from '../health'

const app = new Hono()
app.route('/api/health', health)

describe('GET /api/health', () => {
  it('returns status ok with timestamp', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)

    const body = await res.json() as Record<string, unknown>
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
    expect(new Date(body.timestamp as string).getTime()).not.toBeNaN()
  })
})
