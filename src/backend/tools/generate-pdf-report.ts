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
    'Generates a dynamic PDF report. Pass company_names or sectors to scope the report to specific companies/sectors instead of the full portfolio. Use title/subtitle to customize the header. Use custom_sections to include agent-composed analysis (comparison results, trend analysis, newsletter drafts, etc.).',
  inputSchema: z.object({
    days_back: z.number().min(1).max(90).default(7),
    company_names: z
      .array(z.string())
      .optional()
      .describe('Filter report to these specific companies. Omit for full portfolio.'),
    sectors: z
      .array(z.string())
      .optional()
      .describe('Filter report to these sectors. Omit for all sectors.'),
    title: z
      .string()
      .optional()
      .describe('Custom report title. Defaults to "Initialized Capital".'),
    subtitle: z
      .string()
      .optional()
      .describe('Custom subtitle. Defaults to "Portfolio Intelligence Report".'),
    custom_sections: z
      .array(
        z.object({
          title: z.string().describe('Section heading'),
          content: z.string().describe('Section body — supports markdown-style bullets (- item) and headers (## heading)'),
        })
      )
      .optional()
      .describe('Additional analysis sections composed by the agent based on tool results (comparisons, trend analysis, newsletter summaries).'),
  }),
  execute: async (inputData) => {
    const buffer = await generatePortfolioPDF({
      daysBack: inputData.days_back,
      companyNames: inputData.company_names,
      sectors: inputData.sectors,
      title: inputData.title,
      subtitle: inputData.subtitle,
      customSections: inputData.custom_sections,
    })
    const id = crypto.randomBytes(16).toString('hex')
    pendingReports.set(id, { buffer, expiresAt: Date.now() + 600_000 })

    const scope = inputData.company_names?.length
      ? `Focused on: ${inputData.company_names.join(', ')}`
      : inputData.sectors?.length
        ? `Focused on sectors: ${inputData.sectors.join(', ')}`
        : 'Full portfolio report'

    return {
      reportId: id,
      downloadPath: `/api/reports/download/${id}`,
      pages: 'Multi-page PDF with charts and analysis',
      scope,
      daysBack: inputData.days_back,
      expiresIn: '10 minutes',
    }
  },
})
