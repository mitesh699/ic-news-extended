import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'

export const draftNewsletter = createTool({
  id: 'draft-newsletter',
  description:
    'Assembles a structured markdown newsletter from recent portfolio data. Groups content into top signals, company briefs, and sector trends.',
  inputSchema: z.object({
    days_back: z.number().default(7),
  }),
  execute: async (inputData) => {
    const since = new Date()
    since.setDate(since.getDate() - inputData.days_back)

    const [articles, summaries, companies] = await Promise.all([
      db.article.findMany({
        where: { fetchedAt: { gte: since } },
        orderBy: { publishedAt: 'desc' },
        include: { company: { select: { name: true, sector: true } } },
      }),
      db.summary.findMany({
        where: { generatedAt: { gte: since } },
        orderBy: { generatedAt: 'desc' },
        include: { company: { select: { name: true, sector: true } } },
      }),
      db.company.findMany({
        select: { id: true, name: true, sector: true },
      }),
    ])

    // --- Top Signals: breaking or negative-sentiment articles ---
    const topSignals = articles.filter((a) => a.isBreaking || a.sentiment === 'negative')

    // --- Company Briefs: latest summary per company ---
    const summaryByCompany = new Map<string, typeof summaries[0]>()
    for (const s of summaries) {
      if (!summaryByCompany.has(s.companyId)) {
        summaryByCompany.set(s.companyId, s)
      }
    }

    // --- Sector Trends: group companies by sector ---
    const sectorMap = new Map<string, string[]>()
    for (const c of companies) {
      const sector = c.sector || 'Other'
      const names = sectorMap.get(sector) || []
      names.push(c.name)
      sectorMap.set(sector, names)
    }

    // Build markdown
    const lines: string[] = []
    const dateStr = new Date().toISOString().slice(0, 10)
    lines.push(`# Portfolio Newsletter — ${dateStr}`)
    lines.push('')

    // Top Signals
    lines.push('## Top Signals')
    lines.push('')
    if (topSignals.length === 0) {
      lines.push('No breaking or negative signals in this period.')
    } else {
      for (const a of topSignals.slice(0, 20)) {
        const tag = a.isBreaking ? '**BREAKING**' : '**NEGATIVE**'
        lines.push(`- ${tag} [${a.company.name}] ${a.title}`)
      }
    }
    lines.push('')

    // Company Briefs
    lines.push('## Company Briefs')
    lines.push('')
    if (summaryByCompany.size === 0) {
      lines.push('No summaries generated in this period.')
    } else {
      for (const [, s] of summaryByCompany) {
        let outlook = ''
        if (s.metadata) {
          try {
            const meta = JSON.parse(s.metadata)
            outlook = meta.outlook ? ` (Outlook: ${meta.outlook})` : ''
          } catch { /* ignore */ }
        }
        lines.push(`### ${s.company.name}${outlook}`)
        lines.push('')
        lines.push(s.summaryText)
        lines.push('')
      }
    }

    // Sector Trends
    lines.push('## Sector Trends')
    lines.push('')
    if (sectorMap.size === 0) {
      lines.push('No sector data available.')
    } else {
      for (const [sector, names] of sectorMap) {
        const sectorArticles = articles.filter((a) => a.company.sector === sector)
        lines.push(`### ${sector}`)
        lines.push(`Companies: ${names.join(', ')}`)
        lines.push(`Articles this period: ${sectorArticles.length}`)
        lines.push('')
      }
    }

    return {
      markdown: lines.join('\n'),
      companiesIncluded: summaryByCompany.size,
      articlesCovered: articles.length,
    }
  },
})
