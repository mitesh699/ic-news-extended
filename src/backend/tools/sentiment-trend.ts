import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../../db/client'

interface WeekBucket {
  weekStart: string
  positive: number
  negative: number
  neutral: number
  total: number
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d.toISOString().slice(0, 10)
}

export const sentimentTrend = createTool({
  id: 'sentiment_trend',
  description:
    'Weekly sentiment breakdown for a portfolio company. Returns positive/negative/neutral counts per week. Use when a user asks about sentiment trends or trajectory.',
  inputSchema: z.object({
    company_name: z.string().describe('Company name (partial match supported)'),
    weeks: z.number().default(4).describe('Number of weeks to analyze (default 4)'),
  }),
  execute: async (inputData) => {
    const company = await db.company.findFirst({
      where: { name: { contains: inputData.company_name, mode: 'insensitive' } },
      select: { id: true, name: true },
    })

    if (!company) {
      return { found: false, message: `No company matching "${inputData.company_name}" in portfolio.` }
    }

    const since = new Date()
    since.setDate(since.getDate() - inputData.weeks * 7)

    const articles = await db.article.findMany({
      where: {
        companyId: company.id,
        fetchedAt: { gte: since },
      },
      select: { fetchedAt: true, sentiment: true },
      orderBy: { fetchedAt: 'asc' },
    })

    const buckets = new Map<string, WeekBucket>()
    for (const a of articles) {
      const ws = getWeekStart(a.fetchedAt)
      const bucket = buckets.get(ws) ?? { weekStart: ws, positive: 0, negative: 0, neutral: 0, total: 0 }
      if (a.sentiment === 'positive') bucket.positive++
      else if (a.sentiment === 'negative') bucket.negative++
      else bucket.neutral++
      bucket.total++
      buckets.set(ws, bucket)
    }

    return {
      found: true,
      company: company.name,
      weeks: Array.from(buckets.values()),
    }
  },
})
