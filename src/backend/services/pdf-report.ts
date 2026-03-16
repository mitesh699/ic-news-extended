import PDFDocument from 'pdfkit'
import { db } from '../db/client'
import {
  renderSentimentPie,
  renderSectorBarChart,
  renderSignalBreakdown,
  renderSentimentTrend,
} from './chart-renderer'
import { parseJsonResponse } from '../utils/parse-json'

interface CustomSection {
  title: string
  content: string
}

interface PDFOptions {
  daysBack?: number
  companyNames?: string[]
  sectors?: string[]
  title?: string
  subtitle?: string
  customSections?: CustomSection[]
}

const BLUE = '#1e40af'
const GRAY = '#475569'
const DARK = '#0f172a'
const LIGHT_GRAY = '#94a3b8'
const RULE_COLOR = '#e2e8f0'

export async function generatePortfolioPDF(options: PDFOptions = {}): Promise<Buffer> {
  const daysBack = options.daysBack ?? 7
  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const companyFilter: Record<string, unknown> = {}
  if (options.companyNames?.length) {
    companyFilter.name = { in: options.companyNames, mode: 'insensitive' }
  }
  if (options.sectors?.length) {
    companyFilter.sector = { in: options.sectors, mode: 'insensitive' }
  }
  const hasFilter = Object.keys(companyFilter).length > 0

  const [articles, summaries, companies] = await Promise.all([
    db.article.findMany({
      where: {
        fetchedAt: { gte: since },
        ...(hasFilter ? { company: companyFilter } : {}),
      },
      orderBy: { fetchedAt: 'desc' },
      include: { company: { select: { name: true, sector: true } } },
    }),
    db.summary.findMany({
      where: {
        generatedAt: { gte: since },
        ...(hasFilter ? { company: companyFilter } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      include: { company: { select: { name: true, sector: true } } },
    }),
    db.company.findMany({
      where: hasFilter ? companyFilter : undefined,
      select: { id: true, name: true, sector: true },
    }),
  ])

  // ── Aggregate data ──
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }
  const sectorCounts = new Map<string, number>()
  const signalCounts: Record<string, number> = {}
  const dailySentiment = new Map<string, { positive: number; negative: number; neutral: number }>()

  for (const a of articles) {
    const s = (a.sentiment as 'positive' | 'negative' | 'neutral') || 'neutral'
    sentimentCounts[s]++

    const sector = a.company.sector || 'Other'
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)

    // Fix #3: use fetchedAt for trend x-axis (not publishedAt which can be months old)
    const dateKey = a.fetchedAt.toISOString().slice(0, 10)
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

  // ── Fix #1: Deduplicate top signals by company ──
  const signalArticles = articles.filter((a) => a.isBreaking || a.sentiment === 'negative')
  const seenCompanies = new Set<string>()
  const dedupedSignals: typeof signalArticles = []
  for (const a of signalArticles) {
    if (seenCompanies.has(a.company.name)) continue
    seenCompanies.add(a.company.name)
    dedupedSignals.push(a)
  }
  const topSignals = dedupedSignals.slice(0, 25)

  // ── Fix #2: Filter company briefs to only material news ──
  const summaryByCompany = new Map<string, (typeof summaries)[0]>()
  for (const s of summaries) {
    if (summaryByCompany.has(s.companyId)) continue
    const meta = parseJsonResponse<{ outlook?: string }>(s.metadata ?? '{}', {})
    const outlook = meta.outlook?.toLowerCase() ?? 'stable'
    // Skip stable companies with no material developments
    if (outlook === 'stable' && /no material|limited relevant|no substantive|no updates/i.test(s.summaryText)) {
      continue
    }
    summaryByCompany.set(s.companyId, s)
  }

  // ── Render charts ──
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

  // ── Build executive summary bullets ──
  const breakingCount = articles.filter(a => a.isBreaking).length
  const negativeCount = sentimentCounts.negative
  const positiveCount = sentimentCounts.positive
  const topSector = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const topSignalType = Object.entries(signalCounts).sort((a, b) => b[1] - a[1])[0]

  const exitCompanies = topSignals.filter(a =>
    /acqui|merger|exit|bought|ipo/i.test(a.title)
  ).map(a => a.company.name)

  const fundingCompanies = topSignals.filter(a =>
    /raise|series|seed|funding|round/i.test(a.title)
  ).map(a => a.company.name)

  const riskCompanies = topSignals.filter(a =>
    a.sentiment === 'negative'
  ).map(a => a.company.name)

  // ── Build PDF ──
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const dateStr = new Date().toISOString().slice(0, 10)

  function drawRule() {
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(RULE_COLOR).stroke()
    doc.moveDown(0.5)
  }

  function sectionHeader(title: string) {
    doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text(title)
    drawRule()
  }

  /** Add a page break only if less than `minSpace` px remain */
  function ensureSpace(minSpace = 120) {
    if (doc.y > 742 - minSpace) doc.addPage()
  }

  function sectionBreak(title: string) {
    ensureSpace(160)
    doc.moveDown(1.5)
    sectionHeader(title)
  }

  // ══════════════════════════════════════════
  // PAGE 1: Header + Charts
  // ══════════════════════════════════════════
  const reportTitle = options.title || 'Initialized Capital'
  const reportSubtitle = options.subtitle || 'Portfolio Intelligence Report'
  doc.fontSize(22).font('Helvetica-Bold').fillColor(DARK).text(reportTitle, { align: 'center' })
  doc.fontSize(14).font('Helvetica').fillColor(GRAY).text(reportSubtitle, { align: 'center' })
  doc.fontSize(10).fillColor(LIGHT_GRAY).text(
    `Generated ${dateStr} | Last ${daysBack} days | ${articles.length} articles | ${companies.length} companies`,
    { align: 'center' }
  )
  doc.moveDown(1.5)

  sectionHeader('Portfolio Overview')

  if (sentimentPng) doc.image(sentimentPng, 50, doc.y, { width: 240 })
  if (sectorPng) doc.image(sectorPng, 305, doc.y, { width: 240 })
  doc.y += 200
  doc.moveDown(1)

  if (signalPng) doc.image(signalPng, 50, doc.y, { width: 240 })
  if (trendPng) doc.image(trendPng, 305, doc.y, { width: 240 })
  if (signalPng || trendPng) {
    doc.y += 200
    doc.moveDown(1)
  }

  // ══════════════════════════════════════════
  // Executive Summary
  // ══════════════════════════════════════════
  sectionBreak('Executive Summary')

  doc.fontSize(12).fillColor(GRAY).font('Helvetica')

  const bullets: string[] = [
    `${articles.length} articles tracked across ${companies.length} companies this period. ${breakingCount} breaking signals, ${positiveCount} positive, ${negativeCount} negative.`,
  ]

  if (exitCompanies.length > 0) {
    bullets.push(`M&A / Exits: ${exitCompanies.join(', ')} — significant corporate events requiring partner attention.`)
  }

  if (fundingCompanies.length > 0) {
    bullets.push(`Funding activity: ${fundingCompanies.join(', ')} raised new capital this period.`)
  }

  if (riskCompanies.length > 0) {
    bullets.push(`Risk flags: ${riskCompanies.slice(0, 5).join(', ')} — negative sentiment warrants monitoring.`)
  }

  if (topSector) {
    bullets.push(`${topSector[0]} leads article volume with ${topSector[1]} articles.${topSignalType ? ` Top signal type: ${topSignalType[0]} (${topSignalType[1]} instances).` : ''}`)
  }

  bullets.push(`${summaryByCompany.size} companies had material developments (of ${companies.length} tracked). ${companies.length - summaryByCompany.size} had no actionable news.`)

  for (const bullet of bullets) {
    if (doc.y > 700) doc.addPage()
    doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold').text('  •  ', { continued: true })
    doc.font('Helvetica').fillColor(GRAY).text(bullet)
    doc.moveDown(0.5)
  }
  doc.moveDown(1)

  // ══════════════════════════════════════════
  // Top Signals (deduplicated)
  // ══════════════════════════════════════════
  sectionBreak('Top Signals')

  if (topSignals.length === 0) {
    doc.fontSize(12).fillColor(GRAY).font('Helvetica').text('No breaking or negative signals in this period.')
  } else {
    for (const a of topSignals) {
      if (doc.y > 700) doc.addPage()
      const tag = a.isBreaking ? 'BREAKING' : 'NEGATIVE'
      doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold').text(`[${tag}] `, { continued: true })
      doc.font('Helvetica').fillColor(GRAY).text(`${a.company.name} — ${a.title}`)
      doc.moveDown(0.3)
    }
  }
  doc.moveDown(1)

  // ══════════════════════════════════════════
  // Company Briefs (material only)
  // ══════════════════════════════════════════
  sectionBreak(`Company Briefs (${summaryByCompany.size} with material news)`)

  if (summaryByCompany.size === 0) {
    doc.fontSize(12).fillColor(GRAY).font('Helvetica').text('No summaries generated in this period.')
  } else {
    for (const [, s] of summaryByCompany) {
      if (doc.y > 650) doc.addPage()

      const meta = parseJsonResponse<{ outlook?: string }>(s.metadata ?? '{}', {})
      const outlook = meta.outlook ?? ''

      doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold').text(`${s.company.name}${outlook ? ` (${outlook})` : ''}`)
      doc.fontSize(11).fillColor(GRAY).font('Helvetica').text(s.summaryText)
      doc.moveDown(0.6)
    }
  }

  // ══════════════════════════════════════════
  // Sector Overview
  // ══════════════════════════════════════════
  sectionBreak('Sector Overview')

  const sorted = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])
  doc.fontSize(11).fillColor('#334155').font('Helvetica-Bold')
  doc.text('Sector', 50, doc.y, { continued: false })
  doc.text('Articles', 400, doc.y - 11, { width: 100, align: 'right' })
  doc.moveDown(0.3)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(RULE_COLOR).stroke()
  doc.moveDown(0.3)

  doc.font('Helvetica').fillColor(GRAY).fontSize(11)
  for (const [sector, count] of sorted) {
    if (doc.y > 700) doc.addPage()
    doc.text(sector, 50, doc.y)
    doc.text(String(count), 400, doc.y - 11, { width: 100, align: 'right' })
    doc.moveDown(0.3)
  }

  // ══════════════════════════════════════════
  // Custom Sections (agent-provided analysis)
  // ══════════════════════════════════════════
  if (options.customSections?.length) {
    for (const section of options.customSections) {
      sectionBreak(section.title)
      doc.fontSize(11).fillColor(GRAY).font('Helvetica')
      const lines = section.content.split('\n')
      for (const line of lines) {
        if (doc.y > 700) doc.addPage()
        if (line.startsWith('## ')) {
          doc.moveDown(0.5)
          doc.fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(line.slice(3))
          doc.moveDown(0.3)
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold').text('  •  ', { continued: true })
          doc.font('Helvetica').fillColor(GRAY).text(line.slice(2))
          doc.moveDown(0.2)
        } else if (line.trim() === '') {
          doc.moveDown(0.4)
        } else {
          doc.fontSize(11).fillColor(GRAY).font('Helvetica').text(line)
          doc.moveDown(0.2)
        }
      }
    }
  }

  // ── Footer ──
  doc.moveDown(2)
  doc.fontSize(9).fillColor(LIGHT_GRAY).text('Initialized Capital — Confidential', { align: 'center' })

  doc.end()
  return done
}
