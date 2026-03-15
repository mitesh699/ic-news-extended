import { db } from '../db/client'
import { fetchExaNews } from '../adapters/exa'
import { classifySentiment } from '../adapters/llm'
import { sleep } from '../utils/sleep'
import { hashUrl } from '../utils/hash'

export async function addCompetitor(
  companyId: string,
  name: string,
  opts: { website?: string; description?: string; sector?: string; relevance?: 'direct' | 'indirect' } = {}
) {
  return db.competitor.create({
    data: {
      companyId,
      name,
      website: opts.website,
      description: opts.description,
      sector: opts.sector,
      relevance: opts.relevance ?? 'direct',
    },
  })
}

export async function removeCompetitor(competitorId: string) {
  return db.competitor.delete({ where: { id: competitorId } })
}

export async function getCompetitorsForCompany(companyId: string) {
  return db.competitor.findMany({
    where: { companyId },
    include: {
      articles: {
        orderBy: { fetchedAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function fetchNewsForCompetitor(competitorId: string): Promise<number> {
  const competitor = await db.competitor.findUnique({
    where: { id: competitorId },
    include: { company: { select: { sector: true } } },
  })
  if (!competitor) return 0

  const sector = competitor.sector || competitor.company.sector || 'Technology'
  const query = `"${competitor.name}" ${sector} company news`

  let articles
  try {
    articles = await fetchExaNews(query)
  } catch {
    return 0
  }

  if (articles.length === 0) return 0

  const sentimentResults = await classifySentiment(
    articles.map((a) => a.title),
    competitor.name,
    sector
  )

  const data = articles.slice(0, 8).map((article, i) => {
    const sent = sentimentResults[i]
    const hostname = article.source || ''
    return {
      competitorId,
      title: article.title,
      url: article.url,
      source: hostname,
      sourceName: formatSourceName(hostname),
      summary: sent.summary,
      publishedAt: article.publishedAt,
      urlHash: hashUrl(article.url),
      sentiment: sent.sentiment,
      signal: detectSignal(article.title),
    }
  })

  const { count } = await db.competitorArticle.createMany({
    data,
    skipDuplicates: true,
  })

  return count
}

function formatSourceName(hostname: string): string {
  return hostname
    .replace('www.', '')
    .split('.')[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function detectSignal(title: string): string | null {
  const lower = title.toLowerCase()
  if (/\b(raise[ds]?|funding|series [a-z]|seed|ipo|valuation)\b/.test(lower)) return 'funding'
  if (/\b(hiring|hire[ds]?|headcount|recruit|layoff|laid off)\b/.test(lower)) return 'hiring'
  if (/\b(launch|release|product|feature|update|beta)\b/.test(lower)) return 'product'
  if (/\b(regulat|comply|compliance|fda|sec |ftc|doj|antitrust)\b/.test(lower)) return 'regulatory'
  if (/\b(acqui|merger|buyout|m&a|takeover)\b/.test(lower)) return 'M&A'
  if (/\b(breach|hack|lawsuit|shutdown|bankruptcy|layoff)\b/.test(lower)) return 'risk'
  return null
}

const COMPETITOR_BATCH_SIZE = 3
const COMPETITOR_BATCH_DELAY_MS = 2_000

export async function fetchNewsForAllCompetitors(): Promise<{ total: number; processed: number }> {
  const competitors = await db.competitor.findMany()
  let total = 0
  let processed = 0

  for (let i = 0; i < competitors.length; i += COMPETITOR_BATCH_SIZE) {
    const batch = competitors.slice(i, i + COMPETITOR_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map((c) => fetchNewsForCompetitor(c.id))
    )

    for (const result of results) {
      processed++
      if (result.status === 'fulfilled') total += result.value
    }

    if (i + COMPETITOR_BATCH_SIZE < competitors.length) {
      await sleep(COMPETITOR_BATCH_DELAY_MS)
    }
  }

  return { total, processed }
}
