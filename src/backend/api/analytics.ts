import { Hono } from 'hono'
import { db } from '../db/client'

interface SignalRow {
  sector: string
  signals: Record<string, number>
}

interface SentimentRow {
  date: string
  positive: number
  negative: number
  neutral: number
}

const SIGNAL_TYPES = ['funding', 'hiring', 'product', 'regulatory', 'M&A', 'risk', 'partnership'] as const

const app = new Hono()

app.get('/signals', async (c) => {
  const summaries = await db.summary.findMany({
    select: { metadata: true, company: { select: { sector: true } } },
    where: { company: { sector: { not: null } } },
  })

  const sectorMap = new Map<string, Record<string, number>>()

  for (const s of summaries) {
    const sector = s.company.sector ?? 'Unknown'
    if (!sectorMap.has(sector)) {
      const empty: Record<string, number> = {}
      for (const t of SIGNAL_TYPES) empty[t] = 0
      sectorMap.set(sector, empty)
    }
    const counts = sectorMap.get(sector)!

    if (!s.metadata) continue
    try {
      const meta = JSON.parse(s.metadata) as { signals?: string[] }
      if (Array.isArray(meta.signals)) {
        for (const sig of meta.signals) {
          if (sig in counts) counts[sig]++
        }
      }
    } catch { /* skip malformed metadata */ }
  }

  const result: SignalRow[] = []
  for (const [sector, signals] of sectorMap) {
    result.push({ sector, signals })
  }

  return c.json(result)
})

app.get('/sentiment-trend', async (c) => {
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const articles = await db.article.findMany({
    select: { publishedAt: true, fetchedAt: true, sentiment: true },
    where: {
      OR: [
        { publishedAt: { gte: fourteenDaysAgo } },
        { publishedAt: null, fetchedAt: { gte: fourteenDaysAgo } },
      ],
    },
  })

  const dayMap = new Map<string, { positive: number; negative: number; neutral: number }>()

  for (const a of articles) {
    const d = a.publishedAt ?? a.fetchedAt
    const dateKey = d.toISOString().slice(0, 10)
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { positive: 0, negative: 0, neutral: 0 })
    }
    const bucket = dayMap.get(dateKey)!
    if (a.sentiment === 'positive') bucket.positive++
    else if (a.sentiment === 'negative') bucket.negative++
    else bucket.neutral++
  }

  const result: SentimentRow[] = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))

  return c.json(result)
})

export default app
