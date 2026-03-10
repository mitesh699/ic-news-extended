import { db } from '../db/client'
import { generateSummary, StructuredSummary } from '../adapters/llm'
import { LLM_DELAY_MS } from '../utils/rate-limiter'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateSummaryForCompany(companyId: string): Promise<boolean> {
  const company = await db.company.findUnique({ where: { id: companyId } })
  if (!company) return false

  // Check if new articles exist since last summary
  const latestSummary = await db.summary.findFirst({
    where: { companyId },
    orderBy: { generatedAt: 'desc' },
  })

  const whereClause: { companyId: string; fetchedAt?: { gt: Date } } = { companyId }
  if (latestSummary) {
    whereClause.fetchedAt = { gt: latestSummary.generatedAt }
  }

  const newArticleCount = await db.article.count({ where: whereClause })
  if (newArticleCount === 0 && latestSummary) {
    console.log(`Skipping ${company.name} — no new articles since last summary`)
    return false
  }

  // Get recent articles for summary (including sentiment for context)
  const articles = await db.article.findMany({
    where: { companyId },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  })

  if (articles.length === 0) {
    console.log(`Skipping ${company.name} — no articles`)
    return false
  }

  // Get previous outlook for trend context
  let previousOutlook: string | null = null
  if (latestSummary?.metadata) {
    try {
      const meta = JSON.parse(latestSummary.metadata)
      previousOutlook = meta.outlook || null
    } catch { /* ignore */ }
  }

  const result: StructuredSummary | null = await generateSummary({
    companyName: company.name,
    companyDescription: company.description || '',
    sector: company.sector || 'Technology',
    articleCount: newArticleCount + (latestSummary ? articles.length : 0),
    previousOutlook,
    articles: articles.map((a) => ({
      title: a.title,
      source: a.source || 'unknown',
      publishedAt: a.publishedAt,
      sentiment: a.sentiment,
      summary: a.summary,
    })),
  })

  if (!result) {
    console.log(`No summary generated for ${company.name}`)
    return false
  }

  // Store the full structured summary as JSON, with the plain text in summaryText
  const metadata = {
    keyThemes: result.keyThemes,
    outlook: result.outlook,
    actionItems: result.actionItems,
    confidence: result.confidence,
    signals: result.signals ?? [],
  }

  await db.summary.create({
    data: {
      companyId,
      summaryText: result.summary,
      promptVersion: 'v2',
      articleCount: articles.length,
      metadata: JSON.stringify(metadata),
    },
  })

  console.log(`Summary generated for ${company.name} [outlook: ${result.outlook}, themes: ${result.keyThemes.join(', ')}]`)
  return true
}

const SUMMARY_BATCH_SIZE = 3
const SUMMARY_BATCH_DELAY_MS = 2_000

export async function generateSummariesForAll(): Promise<{ generated: number; skipped: number; errors: number }> {
  const companies = await db.company.findMany()
  let generated = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < companies.length; i += SUMMARY_BATCH_SIZE) {
    const batch = companies.slice(i, i + SUMMARY_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((company) => generateSummaryForCompany(company.id))
    )

    for (const result of results) {
      if (result.status === 'rejected') errors++
      else if (result.value) generated++
      else skipped++
    }

    if (i + SUMMARY_BATCH_SIZE < companies.length) {
      await sleep(SUMMARY_BATCH_DELAY_MS)
    }
  }

  return { generated, skipped, errors }
}
