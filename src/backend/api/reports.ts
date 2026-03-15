import { Hono } from 'hono'
import { generatePortfolioPDF } from '../services/pdf-report'

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

  const arrayBuffer = new ArrayBuffer(pdf.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < pdf.length; i++) view[i] = pdf[i]
  return c.body(arrayBuffer)
})

export default reports
