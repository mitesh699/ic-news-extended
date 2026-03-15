import { Hono } from 'hono'
import { generatePortfolioPDF } from '../services/pdf-report'
import { getPendingReport } from '../tools/generate-pdf-report'

const reports = new Hono()

reports.get('/pdf', async (c) => {
  const daysParam = c.req.query('days')
  const daysBack = daysParam ? parseInt(daysParam, 10) : 7

  if (isNaN(daysBack) || daysBack < 1 || daysBack > 90) {
    return c.json({ error: 'days must be between 1 and 90' }, 400)
  }

  const pdf = await generatePortfolioPDF({ daysBack })
  const dateStr = new Date().toISOString().slice(0, 10)

  c.header('Content-Type', 'application/pdf')
  c.header('Content-Disposition', `attachment; filename="portfolio-report-${dateStr}.pdf"`)

  return c.body(new Uint8Array(pdf))
})

reports.get('/download/:id', async (c) => {
  const id = c.req.param('id')
  const buffer = getPendingReport(id)

  if (!buffer) {
    return c.json({ error: 'Report not found or expired' }, 404)
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  c.header('Content-Type', 'application/pdf')
  c.header('Content-Disposition', `attachment; filename="portfolio-report-${dateStr}.pdf"`)

  return c.body(new Uint8Array(buffer))
})

export default reports
