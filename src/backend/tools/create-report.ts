import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '../db/client'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildSentimentChartUrl(positive: number, neutral: number, negative: number): string {
  const config = {
    type: 'doughnut' as const,
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [
        {
          data: [positive, neutral, negative],
          backgroundColor: ['#22c55e', '#94a3b8', '#ef4444'],
        },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Sentiment Distribution' },
      },
    },
  }
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}`
}

export const createReport = createTool({
  id: 'create-report',
  description:
    'Generates a full HTML report for a given topic (company name or sector). Includes an article table, sentiment summary, and optional chart.',
  inputSchema: z.object({
    topic: z.string(),
    include_charts: z.boolean().default(true),
  }),
  execute: async (inputData) => {
    const topic = inputData.topic
    const topicLower = topic.toLowerCase()

    // Find articles matching topic as company name or sector
    const articles = await db.article.findMany({
      where: {
        company: {
          OR: [
            { name: { contains: topic, mode: 'insensitive' } },
            { sector: { contains: topic, mode: 'insensitive' } },
          ],
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: { company: { select: { name: true, sector: true } } },
    })

    // Find relevant summaries
    const summaries = await db.summary.findMany({
      where: {
        company: {
          OR: [
            { name: { contains: topic, mode: 'insensitive' } },
            { sector: { contains: topic, mode: 'insensitive' } },
          ],
        },
      },
      orderBy: { generatedAt: 'desc' },
      take: 10,
      include: { company: { select: { name: true } } },
    })

    // Sentiment counts
    let positive = 0
    let neutral = 0
    let negative = 0
    for (const a of articles) {
      if (a.sentiment === 'positive') positive++
      else if (a.sentiment === 'negative') negative++
      else neutral++
    }

    const title = `Report: ${escapeHtml(topic)}`
    const dateStr = new Date().toISOString().slice(0, 10)

    // Build article rows
    const articleRows = articles
      .map((a) => {
        const date = a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : 'N/A'
        const sentimentColor =
          a.sentiment === 'positive' ? '#22c55e' : a.sentiment === 'negative' ? '#ef4444' : '#94a3b8'
        return `<tr>
          <td>${escapeHtml(a.company.name)}</td>
          <td><a href="${escapeHtml(a.url)}">${escapeHtml(a.title)}</a></td>
          <td>${escapeHtml(a.source || 'Unknown')}</td>
          <td><span style="color:${sentimentColor};font-weight:600">${escapeHtml(a.sentiment || 'unknown')}</span></td>
          <td>${date}</td>
        </tr>`
      })
      .join('\n')

    // Build summary section
    const summaryHtml = summaries
      .map((s) => `<div style="margin-bottom:12px"><strong>${escapeHtml(s.company.name)}</strong><p>${escapeHtml(s.summaryText)}</p></div>`)
      .join('\n')

    // Optional chart
    let chartHtml = ''
    if (inputData.include_charts && articles.length > 0) {
      const chartUrl = buildSentimentChartUrl(positive, neutral, negative)
      chartHtml = `<div style="text-align:center;margin:24px 0">
        <img src="${escapeHtml(chartUrl)}" alt="Sentiment chart" width="400" height="300" />
      </div>`
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; color: #1e293b; background: #f8fafc; }
  h1 { font-size: 1.75rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h2 { font-size: 1.25rem; margin-top: 32px; color: #334155; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .meta { color: #64748b; font-size: 0.875rem; margin-top: 4px; }
  .sentiment-summary { display: flex; gap: 24px; margin-top: 12px; }
  .sentiment-summary span { font-weight: 600; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">Generated ${dateStr} &middot; ${articles.length} articles</p>

<h2>Sentiment Summary</h2>
<div class="sentiment-summary">
  <div><span style="color:#22c55e">${positive}</span> Positive</div>
  <div><span style="color:#94a3b8">${neutral}</span> Neutral</div>
  <div><span style="color:#ef4444">${negative}</span> Negative</div>
</div>
${chartHtml}

${summaries.length > 0 ? `<h2>AI Summaries</h2>\n${summaryHtml}` : ''}

<h2>Articles</h2>
<table>
  <thead>
    <tr><th>Company</th><th>Title</th><th>Source</th><th>Sentiment</th><th>Date</th></tr>
  </thead>
  <tbody>
    ${articleRows || '<tr><td colspan="5">No articles found for this topic.</td></tr>'}
  </tbody>
</table>
</body>
</html>`

    return { html, title }
  },
})
