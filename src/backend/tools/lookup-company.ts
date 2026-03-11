import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'
import { formatMetaContext } from '../utils/parseSummaryMeta'

export const lookupCompany = createTool({
  id: 'lookup_company',
  description:
    'Look up a portfolio company by name. Returns articles, AI summary, sector, and description. Use when a user asks about a specific company.',
  inputSchema: z.object({
    company_name: z.string().describe('Company name (partial match supported)'),
  }),
  execute: async (inputData) => {
    const company = await db.company.findFirst({
      where: { name: { contains: inputData.company_name, mode: 'insensitive' } },
      include: {
        articles: {
          orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }],
          take: 10,
        },
        summaries: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    })

    if (!company) {
      return { found: false, message: `No company matching "${inputData.company_name}" in portfolio.` }
    }

    const summary = company.summaries[0]
    return {
      found: true,
      name: company.name,
      sector: company.sector || 'Unknown',
      description: company.description || 'N/A',
      brief: summary ? `${summary.summaryText}${formatMetaContext(summary.metadata)}` : null,
      articles: company.articles.map((a) => ({
        title: a.title,
        source: a.source ?? 'unknown',
        sentiment: a.sentiment,
        summary: a.summary,
        url: a.url,
      })),
    }
  },
})
