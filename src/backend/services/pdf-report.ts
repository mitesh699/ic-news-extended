import PDFDocument from 'pdfkit'
import { db } from '../db/client'

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

  const topSignals = articles
    .filter((a) => a.isBreaking || a.sentiment === 'negative')
    .slice(0, 20)

  const summaryByCompany = new Map<string, (typeof summaries)[0]>()
  for (const s of summaries) {
    if (!summaryByCompany.has(s.companyId)) {
      summaryByCompany.set(s.companyId, s)
    }
  }

  const sectorCounts = new Map<string, number>()
  for (const a of articles) {
    const sector = a.company.sector || 'Other'
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const dateStr = new Date().toISOString().slice(0, 10)

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('Initialized Capital', { align: 'center' })
  doc.fontSize(14).font('Helvetica').text('Portfolio Intelligence Report', { align: 'center' })
  doc.fontSize(10).fillColor('#64748b').text(`Generated ${dateStr} | Last ${daysBack} days`, { align: 'center' })
  doc.moveDown(1.5)

  // Section 1: Top Signals
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Top Signals')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  if (topSignals.length === 0) {
    doc.fontSize(12).fillColor('#475569').font('Helvetica').text('No breaking or negative signals in this period.')
  } else {
    for (const a of topSignals) {
      const tag = a.isBreaking ? 'BREAKING' : 'NEGATIVE'
      doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(`[${tag}] `, { continued: true })
      doc.font('Helvetica').fillColor('#475569').text(`${a.company.name} — ${a.title}`)
      doc.moveDown(0.3)
    }
  }
  doc.moveDown(1)

  // Section 2: Company Briefs
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Company Briefs')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  if (summaryByCompany.size === 0) {
    doc.fontSize(12).fillColor('#475569').font('Helvetica').text('No summaries generated in this period.')
  } else {
    for (const [, s] of summaryByCompany) {
      let outlook = ''
      if (s.metadata) {
        try {
          const meta = JSON.parse(s.metadata) as Record<string, unknown>
          if (typeof meta.outlook === 'string') outlook = ` (Outlook: ${meta.outlook})`
        } catch { /* ignore */ }
      }

      doc.fontSize(13).fillColor('#0f172a').font('Helvetica-Bold').text(`${s.company.name}${outlook}`)
      doc.fontSize(12).fillColor('#475569').font('Helvetica').text(s.summaryText)
      doc.moveDown(0.8)
    }
  }
  doc.moveDown(1)

  // Section 3: Sector Overview
  doc.fontSize(16).fillColor(BLUE).font('Helvetica-Bold').text('Sector Overview')
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
  doc.moveDown(0.5)

  if (sectorCounts.size === 0) {
    doc.fontSize(12).fillColor('#475569').font('Helvetica').text('No sector data available.')
  } else {
    const sorted = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])

    // Table header
    const colX = 50
    const colCountX = 400
    doc.fontSize(12).fillColor('#334155').font('Helvetica-Bold')
    doc.text('Sector', colX, doc.y)
    doc.text('Articles', colCountX, doc.y - 12, { width: 100, align: 'right' })
    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
    doc.moveDown(0.3)

    doc.font('Helvetica').fillColor('#475569').fontSize(12)
    for (const [sector, count] of sorted) {
      const companyNames = companies
        .filter((c) => (c.sector || 'Other') === sector)
        .map((c) => c.name)
        .join(', ')

      doc.text(sector, colX, doc.y)
      doc.text(String(count), colCountX, doc.y - 12, { width: 100, align: 'right' })

      if (companyNames) {
        doc.fontSize(10).fillColor('#94a3b8').text(`  ${companyNames}`)
        doc.fontSize(12).fillColor('#475569')
      }
      doc.moveDown(0.3)
    }
  }

  // Footer
  doc.moveDown(2)
  doc.fontSize(9).fillColor('#94a3b8').text('Initialized Capital — Confidential', { align: 'center' })

  doc.end()
  return done
}
