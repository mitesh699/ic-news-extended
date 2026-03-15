import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'
import { parseJsonResponse } from '../utils/parse-json'

export const portfolioHealth = createTool({
  id: 'portfolio_health',
  description:
    'Portfolio-wide health check. Surfaces breaking news, negative sentiment, signal events (funding/M&A/hiring/risk), and companies with no recent coverage.',
  inputSchema: z.object({
    signal_type: z.string().optional().describe('Filter by signal type: funding, hiring, product, regulatory, M&A, risk, partnership'),
    days_back: z.number().default(7).describe('Days to look back (default 7)'),
  }),
  execute: async (inputData) => {
    const since = new Date()
    since.setDate(since.getDate() - inputData.days_back)

    const [allCompanies, recentArticles, recentSummaries] = await Promise.all([
      db.company.findMany({ select: { id: true, name: true, status: true } }),
      db.article.findMany({
        where: { fetchedAt: { gte: since } },
        include: { company: { select: { name: true } } },
        orderBy: { fetchedAt: 'desc' },
      }),
      db.summary.findMany({
        where: { generatedAt: { gte: since } },
        select: { metadata: true, company: { select: { name: true } } },
      }),
    ])

    // Extract signals from summary metadata
    const signalEvents: { company: string; signal: string }[] = []
    for (const s of recentSummaries) {
      if (!s.metadata) continue
      const meta = parseJsonResponse<{ signals?: string[] }>(s.metadata, {})
      if (meta.signals) {
        for (const sig of meta.signals) {
          if (!inputData.signal_type || sig === inputData.signal_type) {
            signalEvents.push({ company: s.company.name, signal: sig })
          }
        }
      }
    }

    const breakingNews = recentArticles
      .filter(a => a.isBreaking)
      .slice(0, 10)
      .map(a => ({ company: a.company.name, title: a.title, source: a.source ?? 'unknown', url: a.url }))

    const negativeSignals = recentArticles
      .filter(a => a.sentiment === 'negative')
      .slice(0, 10)
      .map(a => ({ company: a.company.name, title: a.title, source: a.source ?? 'unknown', url: a.url }))

    const companiesWithArticles = new Set(recentArticles.map(a => a.companyId))
    const coverageGaps = allCompanies
      .filter(c => !companiesWithArticles.has(c.id) && c.status === 'active')
      .map(c => c.name)

    const activeCount = allCompanies.filter(c => c.status === 'active').length
    const exitCount = allCompanies.filter(c => c.status === 'exit').length

    return {
      period: `Last ${inputData.days_back} days`,
      totalArticles: recentArticles.length,
      companiesTracked: allCompanies.length,
      activeCompanies: activeCount,
      exitedCompanies: exitCount,
      breakingNews,
      negativeSignals,
      signalEvents: signalEvents.slice(0, 15),
      coverageGaps: coverageGaps.slice(0, 20),
    }
  },
})
