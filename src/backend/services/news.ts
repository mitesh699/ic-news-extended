import { db } from '../db/client'
import { fetchNewsData, type FetchedArticle } from '../adapters/newsdata'
import { fetchExaNews } from '../adapters/exa'
import { classifySentiment } from '../adapters/llm'
import { createHash } from 'crypto'
import { sleep } from '../utils/sleep'

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

export function parseKeywords(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildSearchQueries(companyName: string, keywords: string[], sector: string): string[] {
  const queries: string[] = []

  // Primary: company name with business context
  queries.push(`"${companyName}" ${sector} company news`)

  // If keywords exist, add keyword-based queries
  if (keywords.length > 0) {
    queries.push(...keywords.slice(0, 2).map(kw => `${kw} news`))
  }

  // Fallback: broader search without sector constraint
  queries.push(`"${companyName}" startup`)

  return queries
}

export function isRelevant(article: FetchedArticle, companyName: string, keywords: string[]): boolean {
  const title = article.title.toLowerCase()
  const url = article.url.toLowerCase()

  // Reject non-article URLs (repos, about pages, app stores, social profiles, directories)
  if (/\/(app|apps|profile|user|company|people|jobs)\b/i.test(url)) {
    return false
  }
  // Block GitHub repos, wikis, issues
  if (/github\.com\/[^/]+\/[^/]+\/?$/i.test(url) || /github\.com\/[^/]+\/[^/]+\/(issues|wiki|pull|tree|blob)\b/i.test(url)) {
    return false
  }
  // Block generic non-news pages
  if (/\/(about|about-us|contact|careers|team|pricing|signup|login|register|faq)\b/i.test(url)) {
    return false
  }

  // Block social media profile pages (not individual posts/articles)
  if (/\/(instagram|twitter|x|facebook|tiktok)\.com\/[^/]+\/?$/i.test(url)) return false
  if (/\/(instagram|twitter|x|facebook|tiktok)\.com\/[^/]+\/?\?/i.test(url)) return false
  // LinkedIn company/person profiles (not pulse/blog articles)
  if (/linkedin\.com\/(company|in|school)\/[^/]+\/?$/i.test(url)) return false
  // YouTube channel/user pages (not individual video watch pages)
  if (/youtube\.com\/(channel|c|user|@)[^/]*\/?$/i.test(url)) return false
  if (/youtube\.com\/(channel|c|user|@)/i.test(url) && !/youtube\.com\/watch/i.test(url)) return false

  // Block stock ticker / finance aggregator quote pages
  if (/\/(quote|quotes|symbol)\//i.test(url)) return false
  if (/finance\..+\.(com|co)\/.*(quote|chart|history|key-statistics|financials|holders)/i.test(url)) return false
  if (/\bstock-price\b|\bstock-quote\b|\bsymbol=/i.test(url)) return false

  // Block Wikipedia pages
  if (/wikipedia\.org\/wiki\//i.test(url)) return false

  // Block wiki, learn, education, and glossary paths
  if (/\/(wiki|learn|education|glossary|what-is|how-to|guide|tutorial|knowledge-base|help-center|support)\//i.test(url)) return false

  // Block app store listings
  if (/\/(apps|play)\.apple\.com|play\.google\.com\/store/i.test(url)) return false
  if (/itunes\.apple\.com\/app/i.test(url)) return false
  if (/\/(app-store|google-play|appstore)\b/i.test(url)) return false

  // Block product/marketing homepages (root or single-segment paths on company domains)
  if (/^https?:\/\/[^/]+\/?$/i.test(url)) return false
  if (/^https?:\/\/[^/]+\/(home|index|welcome|features|solutions|products|platform|get-started|download|how-we-help|how-it-works)\/?(\?.*)?$/i.test(url)) return false

  // Block job boards
  if (/greenhouse\.io/i.test(url)) return false
  if (/lever\.co\/[^/]+\/?$/i.test(url)) return false
  if (/jobs\.lever\.co/i.test(url)) return false

  // Block directory / listing sites
  if (/incubatorlist\.com/i.test(url)) return false
  if (/crunchbase\.com/i.test(url)) return false
  if (/ebay\.(com|co\.uk)/i.test(url)) return false

  // --- Title-based filters ---
  // Social media profile titles
  if (/\b(instagram|twitter|facebook|tiktok)\s+(photos|videos|posts|reels)\b/i.test(title)) return false
  if (/[\(@]\w+[\)]\s*[•·|]\s*(instagram|twitter|x|facebook|tiktok)/i.test(title)) return false

  // Stock quote page titles
  if (/\bstock\s+price\b.*\b(news|quote|history)\b/i.test(title)) return false
  if (/\(\w{1,5}\)\s*stock\s*price/i.test(title)) return false
  if (/\bquote\s*&\s*(summary|chart|news)\b/i.test(title)) return false

  // Wikipedia titles
  if (/\s-\s*wikipedia\s*$/i.test(title)) return false

  // App store listing titles
  if (/\bon the app store\b|\bon google play\b/i.test(title)) return false

  // Generic "What is X" / educational content titles
  if (/^what\s+is\s+/i.test(title) && !/\b(announced|launches|raised|acquired|partnership)\b/i.test(title)) return false

  // "Buy and Sell" / product marketing tagline titles
  if (/\b(buy\s+and\s+sell|sign\s+up|get\s+started|download\s+the\s+app)\b/i.test(title)) return false

  // LinkedIn profile titles
  if (/\blinkedin\s*$/i.test(title) || /\|\s*linkedin\s*$/i.test(title)) return false

  // Job board titles
  if (/^jobs at\b/i.test(title)) return false
  if (/\bcareers\s*[\|&]|\bcareers\s*$/i.test(title)) return false
  if (/\bapply now\b|\bjoin our team\b|\bwe'?re hiring\b/i.test(title)) return false

  // Product tagline / homepage titles
  if (/\ball-in-one\b/i.test(title)) return false
  if (/\bfor small business\b/i.test(title)) return false

  // Block titles that are just company names with no real content
  if (title.replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).length <= 2) {
    return false
  }

  const nameLower = companyName.toLowerCase()
  if (title.includes(nameLower) || url.includes(nameLower.replace(/\s+/g, ''))) {
    return true
  }

  const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2)
  if (nameWords.length > 1 && nameWords.every(w => title.includes(w))) {
    return true
  }

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase()
    const kwWords = kwLower.split(/\s+/)
    if (kwWords.length > 1 && kwWords.every(w => title.includes(w))) {
      return true
    }
    if (title.includes(kwLower)) {
      return true
    }
  }

  return false
}

async function fetchArticlesWithFallback(
  companyName: string,
  keywords: string[],
  sector: string
): Promise<FetchedArticle[]> {
  const queries = buildSearchQueries(companyName, keywords, sector)
  let allArticles: FetchedArticle[] = []

  // Primary: Exa (fast, neural search with highlights)
  if (process.env.EXA_API_KEY) {
    for (const query of queries) {
      try {
        const articles = await fetchExaNews(query, 30)
        allArticles.push(...articles)
        if (allArticles.length >= 5) break
      } catch (err) {
        console.warn(`Exa failed for "${query}":`, err instanceof Error ? err.message : String(err))
      }
    }
  }

  // Fallback: NewsData.io if Exa returned nothing
  if (allArticles.length === 0) {
    for (const query of queries) {
      try {
        const articles = await fetchNewsData(query)
        allArticles.push(...articles)
        if (allArticles.length >= 5) break
      } catch (err) {
        console.warn(`NewsData failed for "${query}":`, err instanceof Error ? err.message : String(err))
      }
    }
  }

  // Filter for relevance
  const relevant = allArticles.filter(a => isRelevant(a, companyName, keywords))

  // Deduplicate by URL
  const seen = new Set<string>()
  return relevant.filter(a => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  }).slice(0, 10)
}

export async function fetchNewsForCompany(companyId: string, companyName: string, keywords: string[] = [], sector: string = 'Technology'): Promise<number> {
  const articles: FetchedArticle[] = await fetchArticlesWithFallback(companyName, keywords, sector)

  if (articles.length === 0) return 0

  // Batch classify sentiment with company context
  const sentimentResults = await classifySentiment(articles.map((a) => a.title), companyName, sector)

  const data = articles.map((article, i) => {
    const sentiment = sentimentResults[i]
    return {
      companyId,
      title: article.title,
      url: article.url,
      source: article.source,
      summary: sentiment.summary || article.summary || null,
      publishedAt: article.publishedAt,
      urlHash: hashUrl(article.url),
      sentiment: sentiment.sentiment,
      isBreaking: sentiment.isBreaking,
    }
  })

  // Verify company still exists before inserting (handles schema resets)
  const companyExists = await db.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!companyExists) return 0

  const { count: insertedCount } = await db.article.createMany({
    data,
    skipDuplicates: true,
  })

  await db.company.update({
    where: { id: companyId },
    data: { lastFetchedAt: new Date() },
  })

  return insertedCount
}

// Process a batch of companies concurrently
async function processBatch(
  companies: { id: string; name: string; keywords: string | null; sector: string | null }[],
  perCompany: Record<string, number>
): Promise<number> {
  const results = await Promise.allSettled(
    companies.map(async (company) => {
      const keywords = parseKeywords(company.keywords)
      const count = await fetchNewsForCompany(company.id, company.name, keywords, company.sector || 'Technology')
      perCompany[company.name] = count
      console.log(`${company.name}: ${count} new articles`)
      return count
    })
  )

  let batchTotal = 0
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      batchTotal += result.value
    } else {
      const name = companies[i].name
      console.error(`Error fetching news for ${name}:`, result.reason instanceof Error ? result.reason.message : String(result.reason))
      perCompany[name] = 0
    }
  }
  return batchTotal
}

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 2_000

export async function fetchNewsForAllCompanies(): Promise<{ total: number; perCompany: Record<string, number> }> {
  const companies = await db.company.findMany()
  const perCompany: Record<string, number> = {}
  let total = 0

  // Filter out recently fetched companies
  const stale = companies.filter((company) => {
    if (company.lastFetchedAt) {
      const hoursSince = (Date.now() - company.lastFetchedAt.getTime()) / 3_600_000
      if (hoursSince < 6) {
        console.log(`Skipping ${company.name} — fetched ${hoursSince.toFixed(1)}h ago`)
        return false
      }
    }
    return true
  })

  console.log(`Processing ${stale.length} companies in batches of ${BATCH_SIZE}...`)

  // Process in batches
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const batch = stale.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(stale.length / BATCH_SIZE)
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.map(c => c.name).join(', ')}`)

    const batchTotal = await processBatch(batch, perCompany)
    total += batchTotal

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < stale.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return { total, perCompany }
}
