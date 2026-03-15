import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'its', 'that', 'this', 'their', 'into', 'which', 'who', 'also', 'as',
  'company', 'companies', 'platform', 'service', 'services', 'provides', 'offers',
])

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOPWORDS.has(w)))
}

export const findRival = createTool({
  id: 'find_portfolio_rival',
  description:
    'Find the closest operational rival to a company within the Initialized portfolio. Matches by business model, sector, and signal overlap — not just sector.',
  inputSchema: z.object({
    company_name: z.string().describe('Company name to find a rival for'),
  }),
  execute: async (inputData) => {
    const target = await db.company.findFirst({
      where: { name: { contains: inputData.company_name, mode: 'insensitive' } },
      include: { summaries: { orderBy: { generatedAt: 'desc' }, take: 1 } },
    })

    if (!target) return { found: false, message: `"${inputData.company_name}" not found in portfolio.` }

    const all = await db.company.findMany({
      include: { summaries: { orderBy: { generatedAt: 'desc' }, take: 1 } },
    })

    const targetWords = tokenize([target.description, target.sector, target.businessProfile].filter(Boolean).join(' '))

    let bestName = ''
    let bestScore = -1
    let bestCompany: typeof all[0] | null = null

    for (const c of all) {
      if (c.id === target.id) continue
      let score = 0
      if (c.sector && target.sector && c.sector.toLowerCase() === target.sector.toLowerCase()) score += 10
      const words = tokenize([c.description, c.sector, c.businessProfile].filter(Boolean).join(' '))
      for (const w of targetWords) { if (words.has(w)) score += 2 }
      if (score > bestScore) {
        bestScore = score
        bestName = c.name
        bestCompany = c
      }
    }

    if (!bestCompany) return { found: false, message: 'No rival found.' }

    const rivalSummary = bestCompany.summaries[0]
    return {
      found: true,
      company: target.name,
      rival: {
        name: bestCompany.name,
        sector: bestCompany.sector,
        description: bestCompany.description,
        businessProfile: bestCompany.businessProfile,
        status: bestCompany.status,
        brief: rivalSummary?.summaryText || null,
      },
      matchScore: bestScore,
    }
  },
})
