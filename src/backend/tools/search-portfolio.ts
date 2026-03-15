import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'

export const searchPortfolio = createTool({
  id: 'search_portfolio',
  description:
    'Search across all portfolio companies by keyword. Matches against company name, description, business profile, and sector. Use when the user mentions a topic and you need to find which companies are relevant.',
  inputSchema: z.object({
    query: z.string().describe('Search keyword or topic (e.g. "AI", "blockchain", "delivery")'),
  }),
  execute: async (inputData) => {
    const q = inputData.query

    const companies = await db.company.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { businessProfile: { contains: q, mode: 'insensitive' } },
          { sector: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        name: true,
        sector: true,
        description: true,
        businessProfile: true,
        status: true,
      },
      take: 15,
    })

    return {
      query: q,
      results: companies.map(c => ({
        name: c.name,
        sector: c.sector,
        description: c.description,
        businessProfile: c.businessProfile,
        status: c.status,
      })),
      count: companies.length,
    }
  },
})
