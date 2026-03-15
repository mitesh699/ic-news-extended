import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'

export const sectorOverview = createTool({
  id: 'sector_overview',
  description:
    'Get AI-generated sector intelligence brief, including trend direction, top signals, competitor moves, and watch list items. Use for sector-level questions.',
  inputSchema: z.object({
    sector: z.string().describe('Sector name (e.g. "Fintech", "Enterprise", "Crypto")'),
  }),
  execute: async (inputData) => {
    const brief = await db.sectorBrief.findFirst({
      where: { sector: { contains: inputData.sector, mode: 'insensitive' } },
      orderBy: { generatedAt: 'desc' },
    })

    const companies = await db.company.findMany({
      where: { sector: { contains: inputData.sector, mode: 'insensitive' } },
      select: { name: true, status: true, description: true },
    })

    if (!brief && companies.length === 0) {
      return { found: false, message: `No data for sector "${inputData.sector}".` }
    }

    let metadata: Record<string, unknown> | null = null
    if (brief?.metadata) {
      try { metadata = JSON.parse(brief.metadata) } catch { /* ignore */ }
    }

    return {
      found: true,
      sector: inputData.sector,
      brief: brief?.briefText || null,
      trendDirection: metadata?.trendDirection || 'stable',
      topSignals: metadata?.topSignals || [],
      competitorMoves: metadata?.competitorMoves || [],
      watchList: metadata?.watchList || [],
      companies: companies.map(c => ({
        name: c.name,
        status: c.status,
        description: c.description,
      })),
      generatedAt: brief?.generatedAt?.toISOString() || null,
    }
  },
})
