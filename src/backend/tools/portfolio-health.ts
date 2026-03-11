import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../../db/client'

export const portfolioHealth = createTool({
  id: 'portfolio_health',
  description:
    'Portfolio-wide health check. Surfaces breaking news, negative sentiment signals, and companies with no recent coverage. Use when a user asks about portfolio risk or overview.',
  inputSchema: z.object({
    signal_type: z
      .string()
      .optional()
      .describe('Optional signal filter (e.g. "risk", "regulatory")'),
    days_back: z
      .number()
      .default(7)
      .describe('Number of days to look back (default 7)'),
  }),
  execute: async (inputData) => {
    const since = new Date()
    since.setDate(since.getDate() - inputData.days_back)

    const allCompanies = await db.company.findMany({
      select: { id: true, name: true },
    })

    const recentArticles = await db.article.findMany({
      where: { fetchedAt: { gte: since } },
      include: { company: { select: { name: true } } },
      orderBy: { fetchedAt: 'desc' },
    })

    const breakingNews = recentArticles
      .filter((a) => a.isBreaking)
      .map((a) => ({
        company: a.company.name,
        title: a.title,
        source: a.source ?? 'unknown',
        sentiment: a.sentiment,
        url: a.url,
      }))

    const negativeSignals = recentArticles
      .filter((a) => a.sentiment === 'negative')
      .map((a) => ({
        company: a.company.name,
        title: a.title,
        source: a.source ?? 'unknown',
        url: a.url,
      }))

    const companiesWithArticles = new Set(recentArticles.map((a) => a.companyId))
    const coverageGaps = allCompanies
      .filter((c) => !companiesWithArticles.has(c.id))
      .map((c) => c.name)

    return {
      period: `Last ${inputData.days_back} days`,
      breakingNews,
      negativeSignals,
      coverageGaps,
      totalArticles: recentArticles.length,
      companiesTracked: allCompanies.length,
    }
  },
})
