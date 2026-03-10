import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client'
import { requireRefreshToken } from '../middleware/auth'

const webhooks = new Hono()

// Auth middleware — all webhook routes require X-Refresh-Token
webhooks.use('*', async (c, next) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }
  await next()
})

const createSchema = z.object({
  url: z.string().url().startsWith('https://'),
  secret: z.string().min(8).optional(),
  events: z.string().default('articles.new'),
})

webhooks.get('/', async (c) => {
  const hooks = await db.webhook.findMany({
    select: { id: true, url: true, events: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return c.json(hooks)
})

webhooks.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, 400)
  }

  const existing = await db.webhook.findUnique({ where: { url: parsed.data.url } })
  if (existing) {
    return c.json({ error: 'Webhook URL already registered', code: 'CONFLICT' }, 409)
  }

  const hook = await db.webhook.create({
    data: {
      url: parsed.data.url,
      secret: parsed.data.secret,
      events: parsed.data.events,
    },
    select: { id: true, url: true, events: true, active: true, createdAt: true },
  })

  return c.json(hook, 201)
})

webhooks.delete('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    await db.webhook.delete({ where: { id } })
    return c.json({ deleted: true })
  } catch {
    return c.json({ error: 'Webhook not found', code: 'NOT_FOUND' }, 404)
  }
})

export default webhooks
