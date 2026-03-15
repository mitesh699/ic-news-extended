import PDFDocument from 'pdfkit'
import { db } from '../db/client'
import {
  renderSentimentPie,
  renderSectorBarChart,
  renderSignalBreakdown,
  renderSentimentTrend,
} from './chart-renderer'
import { parseJsonResponse } from '../utils/parse-json'

interface PDFOptions {
  daysBack?: number
}

const BLUE = '#1e40af'

export async function generatePortfolioPDF(options: PDFOptions = {}): Promise<Buffer> {
  const daysBack = options.daysBack ?? 7
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

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

  // Aggregate data for charts
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
  const sectorCounts = new Map<string, number>()
  const signalCounts: Record<string, number> = {}
  const dailySentiment = new Map<string, { positive: number; negative: number; neutral: number }>()

  for (const a of articles) {
    const s = (a.sentiment as 'positive' | 'negative' | 'neutral') || 'neutral'
    sentimentCounts[s]++

    const sector = a.company.sector || 'Other'
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)

    const dateKey = (a.publishedAt ?? a.fetchedAt).toISOString().slice(0, 10)
    if (!dailySentiment.has(dateKey)) {
      dailySentiment.set(dateKey, { positive: 0, negative: 0, neutral: 0 })
    }
    dailySentiment.get(dateKey)![s]++
  }

  for (const s of summaries) {
    if (!s.metadata) continue
    const meta = parseJsonResponse<{ signals?: string[] }>(s.metadata, {})
    if (meta.signals) {
      for (const sig of meta.signals) {
        signalCounts[sig] = (signalCounts[sig] ?? 0) + 1
      }
    }
  }

  // Render charts in parallel
  const trendData = [...dailySentiment.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date: date.slice(5), ...counts }))

  const sectorData = [...sectorCounts.entries()].map(([sector, count]) => ({ sector, count }))

  const [sentimentPng, sectorPng, signalPng, trendPng] = await Promise.all([
    renderSentimentPie(sentimentCounts),
    renderSectorBarChart(sectorData),
    Object.keys(signalCounts).length > 0 ? renderSignalBreakdown(signalCounts) : null,
    trendData.length > 1 ? renderSentimentTrend(trendData) : null,
  ])

  // Build PDF
  const topSignals = articles
    .filter((a) => a.isBreaking || a.sentiment === 'negative')
    .slice(0, 20)

  const summaryByCompany = new Map<string, (typeof summaries)[0]>()
  for (const s of summaries) {
    if (!summaryByCompany.has(s.companyId)) {
      summaryByCompany.set(s.companyId, s)
    }
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const dateStr = new Date().toISOString().slice(0, 10)

  // ── Header ──
  doc.fontSize(22).font('Helvetica-Bold').text('Initialized Capital', { align: 'center' })
  doc.fontSize(14).font('Helvetica').text('Portfolio Intelligence Report', { align: 'center' })
  doc.fontSize(10).fillColor('#64748b').text(
    `Generated ${dateStr} | Last ${daysBack} days | ${articles.length} articles | ${companies.length} companies`,
    { align: 'center' }
  )
  doc.moveDown(1.5)

  // ── Charts Page ──
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Portfolio Overview')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  // Sentiment pie + sector bar side by side
  if (sentimentPng) {
    doc.image(sentimentPng, 50, doc.y, { width: 240 })
  }
  if (sectorPng) {
    doc.image(sectorPng, 305, doc.y, { width: 240 })
  }
  doc.y += 200
  doc.moveDown(1)

  // Signal breakdown + trend
  if (signalPng) {
    doc.image(signalPng, 50, doc.y, { width: 240 })
  }
  if (trendPng) {
    doc.image(trendPng, 305, doc.y, { width: 240 })
  }
  if (signalPng || trendPng) {
    doc.y += 200
    doc.moveDown(1)
  }

  // ── Top Signals ──
  doc.addPage()
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Top Signals')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  if (topSignals.length === 0) {
    doc.fontSize(12).fillColor('#475569').font('Helvetica').text('No breaking or negative signals in this period.')
  } else {
    for (const a of topSignals) {
      if (doc.y > 700) doc.addPage()
      const tag = a.isBreaking ? 'BREAKING' : 'NEGATIVE'
      doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text(`[${tag}] `, { continued: true })
      doc.font('Helvetica').fillColor('#475569').text(`${a.company.name} — ${a.title}`)
      doc.moveDown(0.3)
    }
  }
  doc.moveDown(1)

  // ── Company Briefs ──
  doc.addPage()
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Company Briefs')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  if (summaryByCompany.size === 0) {
    doc.fontSize(12).fillColor('#475569').font('Helvetica').text('No summaries generated in this period.')
  } else {
    for (const [, s] of summaryByCompany) {
      if (doc.y > 650) doc.addPage()

      let outlook = ''
      if (s.metadata) {
        const meta = parseJsonResponse<{ outlook?: string }>(s.metadata, {})
        if (meta.outlook) outlook = ` (${meta.outlook})`
      }

      doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(`${s.company.name}${outlook}`)
      doc.fontSize(11).fillColor('#475569').font('Helvetica').text(s.summaryText)
      doc.moveDown(0.6)
    }
  }

  // ── Sector Overview ──
  doc.addPage()
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Sector Overview')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  const sorted = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])
  doc.fontSize(11).fillColor('#334155').font('Helvetica-Bold')
  doc.text('Sector', 50, doc.y, { continued: false })
  doc.text('Articles', 400, doc.y - 11, { width: 100, align: 'right' })
  doc.moveDown(0.3)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.3)

  doc.font('Helvetica').fillColor('#475569').fontSize(11)
  for (const [sector, count] of sorted) {
    if (doc.y > 700) doc.addPage()
    doc.text(sector, 50, doc.y)
    doc.text(String(count), 400, doc.y - 11, { width: 100, align: 'right' })
    doc.moveDown(0.3)
  }

  // ── Footer ──
  doc.moveDown(2)
  doc.fontSize(9).fillColor('#94a3b8').text('Initialized Capital — Confidential', { align: 'center' })

  doc.end()
  return done
}
