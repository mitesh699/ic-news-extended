import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client'
import { requireRefreshToken } from '../middleware/auth'

const webhooks = new Hono()

const createSchema = z.object({
  url: z.string().url().startsWith('https://'),
  secret: z.string().min(8).optional(),
  events: z.string().default('articles.new'),
})

// List registered webhooks
webhooks.get('/', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const hooks = await db.webhook.findMany({
    select: { id: true, url: true, events: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return c.json(hooks)
})

// Register a webhook
webhooks.post('/', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

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

// Delete a webhook
webhooks.delete('/:id', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const id = c.req.param('id')

  try {
    await db.webhook.delete({ where: { id } })
    return c.json({ deleted: true })
  } catch {
    return c.json({ error: 'Webhook not found', code: 'NOT_FOUND' }, 404)
  }
})

export default webhooks
