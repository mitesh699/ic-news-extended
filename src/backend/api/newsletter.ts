import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client'

const newsletter = new Hono()

const subscribeSchema = z.object({
  email: z.string().email(),
  frequency: z.enum(['daily', 'weekly']).default('daily'),
})

// Subscribe
newsletter.post('/subscribe', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Valid email required' }, 400)
  }

  const { email, frequency } = parsed.data

  const subscriber = await db.newsletterSubscriber.upsert({
    where: { email },
    update: { frequency, active: true },
    create: { email, frequency },
  })

  return c.json({ subscribed: true, email: subscriber.email, frequency: subscriber.frequency })
})

// Unsubscribe
newsletter.post('/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => null)
  const email = z.string().email().safeParse(body?.email)
  if (!email.success) {
    return c.json({ error: 'Valid email required' }, 400)
  }

  await db.newsletterSubscriber.updateMany({
    where: { email: email.data },
    data: { active: false },
  })

  return c.json({ unsubscribed: true })
})

// List subscribers (admin)
newsletter.get('/subscribers', async (c) => {
  const subs = await db.newsletterSubscriber.findMany({
    where: { active: true },
    select: { email: true, frequency: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return c.json(subs)
})

export default newsletter
