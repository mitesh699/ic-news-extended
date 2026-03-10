import type { MiddlewareHandler } from 'hono'

interface RateLimitOptions {
  windowMs: number
  max: number
}

interface Entry {
  count: number
  resetAt: number
}

export function rateLimiter(opts: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, Entry>()

  // Periodic cleanup to prevent memory leak
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, opts.windowMs * 2).unref()

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown'

    const now = Date.now()
    let entry = store.get(ip)

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + opts.windowMs }
      store.set(ip, entry)
    }

    entry.count++

    c.header('X-RateLimit-Limit', String(opts.max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, opts.max - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > opts.max) {
      return c.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        429
      )
    }

    await next()
  }
}
