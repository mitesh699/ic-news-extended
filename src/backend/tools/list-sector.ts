import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../../db/client'
import { parseSummaryMeta } from '../../utils/parseSummaryMeta'

export const listSectorCompanies = createTool({
  id: 'list_sector_companies',
  description:
    'Look up all portfolio companies in a given sector. Returns outlook, signals, and article count per company. Use when a user asks about a sector or industry.',
  inputSchema: z.object({
    sector: z.string().describe('Sector name (partial match supported, e.g. "fintech", "health")'),
  }),
  execute: async (inputData) => {
    const companies = await db.company.findMany({
      where: { sector: { contains: inputData.sector, mode: 'insensitive' } },
      include: {
        summaries: { orderBy: { generatedAt: 'desc' }, take: 1 },
        articles: { orderBy: { fetchedAt: 'desc' }, take: 3 },
      },
    })

    if (!companies.length) {
      return { found: false, message: `No companies found in sector "${inputData.sector}".` }
    }

    return {
      found: true,
      sector: inputData.sector,
      count: companies.length,
      companies: companies.map((c) => {
        const meta = parseSummaryMeta(c.summaries[0]?.metadata)
        return {
          name: c.name,
          outlook: meta?.outlook ?? 'unknown',
          signals: meta?.signals ?? [],
          articleCount: c.articles.length,
          brief: c.summaries[0]?.summaryText ?? null,
        }
      }),
    }
  },
})
