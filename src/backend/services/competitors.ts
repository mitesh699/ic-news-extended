import { db } from '../db/client'
import { fetchExaNews } from '../adapters/exa'
import { classifySentiment, getAnthropic } from '../adapters/llm'
import { sleep } from '../utils/sleep'
import { hashUrl } from '../utils/hash'

type Signal = 'funding' | 'hiring' | 'product' | 'regulatory' | 'M&A' | 'risk' | 'partnership'
const VALID_SIGNALS: Signal[] = ['funding', 'hiring', 'product', 'regulatory', 'M&A', 'risk', 'partnership']

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

  const sliced = articles.slice(0, 8)
  const signals = await Promise.all(
    sliced.map((article, i) =>
      detectSignal(article.title, sentimentResults[i]?.summary || article.summary)
    )
  )

  const data = sliced.map((article, i) => {
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
      signal: signals[i],
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

function detectSignalRegex(title: string): Signal | null {
  const lower = title.toLowerCase()
  if (/\b(raise[ds]?|funding|series [a-z]|seed|ipo|valuation)\b/.test(lower)) return 'funding'
  if (/\b(hiring|hire[ds]?|headcount|recruit|layoff|laid off)\b/.test(lower)) return 'hiring'
  if (/\b(launch|release|product|feature|update|beta)\b/.test(lower)) return 'product'
  if (/\b(regulat|comply|compliance|fda|sec |ftc|doj|antitrust)\b/.test(lower)) return 'regulatory'
  if (/\b(acqui|merger|buyout|m&a|takeover)\b/.test(lower)) return 'M&A'
  if (/\b(breach|hack|lawsuit|shutdown|bankruptcy|layoff)\b/.test(lower)) return 'risk'
  if (/\b(partner|partnership|collaborat|alliance|joint venture)\b/.test(lower)) return 'partnership'
  return null
}

async function detectSignalLLM(title: string, summary: string): Promise<Signal | null> {
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Classify this article into exactly one signal type or "none".\nValid signals: funding, hiring, product, regulatory, M&A, risk, partnership\n\nTitle: ${title}\nSummary: ${summary}\n\nRespond with a single word only.`,
      }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text.trim().toLowerCase()
      : ''

    const normalized = text === 'm&a' ? 'M&A' : text
    if (VALID_SIGNALS.includes(normalized as Signal)) return normalized as Signal
  } catch {
    // LLM unavailable — fall through
  }
  return null
}

async function detectSignal(title: string, summary?: string): Promise<Signal | null> {
  const regexResult = detectSignalRegex(title)
  if (regexResult) return regexResult

  if (summary && process.env.ANTHROPIC_API_KEY) {
    return detectSignalLLM(title, summary)
  }

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
