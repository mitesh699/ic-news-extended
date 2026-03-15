import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { generatePortfolioPDF } from '../services/pdf-report'
import crypto from 'crypto'

const pendingReports = new Map<string, { buffer: Buffer; expiresAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [id, report] of pendingReports) {
    if (report.expiresAt < now) pendingReports.delete(id)
  }
}, 60_000)

export function getPendingReport(id: string): Buffer | null {
  const report = pendingReports.get(id)
  if (!report || report.expiresAt < Date.now()) {
    pendingReports.delete(id)
    return null
  }
  return report.buffer
}

export const generatePdfReport = createTool({
  id: 'generate-pdf-report',
  description:
    'Generates a PDF portfolio intelligence report with charts (sentiment pie, sector bar chart, signal breakdown, sentiment trend line) and text sections (top signals, company briefs, sector overview). Returns a download link valid for 10 minutes.',
  inputSchema: z.object({
    days_back: z.number().min(1).max(90).default(7),
  }),
  execute: async (inputData) => {
    const buffer = await generatePortfolioPDF({ daysBack: inputData.days_back })
    const id = crypto.randomBytes(16).toString('hex')
    pendingReports.set(id, { buffer, expiresAt: Date.now() + 600_000 })

    return {
      reportId: id,
      downloadPath: `/api/reports/download/${id}`,
      pages: 'Multi-page PDF with charts and analysis',
      daysBack: inputData.days_back,
      expiresIn: '10 minutes',
    }
  },
})
