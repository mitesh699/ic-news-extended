import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../../db/client'
import { parseSummaryMeta } from '../../utils/parseSummaryMeta'

async function loadCompanyProfile(name: string) {
  const company = await db.company.findFirst({
    where: { name: { contains: name, mode: 'insensitive' } },
    include: {
      articles: true,
      summaries: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  })

  if (!company) return null

  const meta = parseSummaryMeta(company.summaries[0]?.metadata)

  let positive = 0
  let negative = 0
  let neutral = 0
  for (const a of company.articles) {
    if (a.sentiment === 'positive') positive++
    else if (a.sentiment === 'negative') negative++
    else neutral++
  }

  return {
    name: company.name,
    sector: company.sector || 'Unknown',
    articleCount: company.articles.length,
    sentimentBreakdown: { positive, negative, neutral },
    latestOutlook: meta?.outlook ?? 'unknown',
    topSignals: meta?.signals ?? [],
  }
}

export const compareCompanies = createTool({
  id: 'compare_companies',
  description:
    'Compare two portfolio companies side-by-side on sector, article volume, sentiment breakdown, outlook, and signals. Use when a user asks to compare or contrast two companies.',
  inputSchema: z.object({
    company_a: z.string().describe('First company name'),
    company_b: z.string().describe('Second company name'),
  }),
  execute: async (inputData) => {
    const [profileA, profileB] = await Promise.all([
      loadCompanyProfile(inputData.company_a),
      loadCompanyProfile(inputData.company_b),
    ])

    if (!profileA && !profileB) {
      return { found: false, message: `Neither "${inputData.company_a}" nor "${inputData.company_b}" found in portfolio.` }
    }
    if (!profileA) {
      return { found: false, message: `"${inputData.company_a}" not found in portfolio.` }
    }
    if (!profileB) {
      return { found: false, message: `"${inputData.company_b}" not found in portfolio.` }
    }

    return {
      found: true,
      companyA: profileA,
      companyB: profileB,
    }
  },
})
