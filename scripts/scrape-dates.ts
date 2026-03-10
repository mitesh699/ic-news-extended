import dotenv from 'dotenv'
dotenv.config()

import { db } from '../src/backend/db/client'

const BATCH_SIZE = 20
const DELAY_MS = 500
const TIMEOUT_MS = 8000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extract publish date from HTML meta tags and structured data.
 * Tries multiple common patterns used by news sites.
 */
function extractDateFromHtml(html: string): Date | null {
  const patterns = [
    // OpenGraph / Facebook
    /<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    // Schema.org
    /<meta[^>]*itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*itemprop=["']datePublished["']/i,
    // Generic date meta tags
    /<meta[^>]*name=["']publication_date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']publish[_-]?date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']DC\.date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']sailthru\.date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']parsely-pub-date["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*name=["']cXenseParse:recs:publishtime["'][^>]*content=["']([^"']+)["']/i,
    // JSON-LD structured data
    /"datePublished"\s*:\s*"([^"]+)"/,
    /"publishedDate"\s*:\s*"([^"]+)"/,
    /"dateCreated"\s*:\s*"([^"]+)"/,
    // time tag
    /<time[^>]*datetime=["']([^"']+)["'][^>]*(?:class=["'][^"']*publish|pubdate)/i,
    /<time[^>]*(?:class=["'][^"']*publish|pubdate)[^>]*datetime=["']([^"']+)["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const parsed = new Date(match[1])
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2027) {
        return parsed
      }
    }
  }
  return null
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    // Only read the first 50KB — dates are always in <head>
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 50_000
    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalBytes += value.length
    }
    reader.cancel()
    return new TextDecoder().decode(Buffer.concat(chunks))
  } catch {
    return null
  }
}

async function main() {
  const articles = await db.article.findMany({
    where: { publishedAt: null },
    select: { id: true, url: true, title: true },
  })

  console.log(`Found ${articles.length} articles with null publishedAt`)
  if (articles.length === 0) return

  let updated = 0
  let noDate = 0
  let failed = 0

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE)

    console.log(`Batch ${batchNum}/${totalBatches} (${updated} updated so far)...`)

    // Fetch all URLs in batch concurrently
    const results = await Promise.allSettled(
      batch.map(async (article) => {
        const html = await fetchWithTimeout(article.url)
        if (!html) return { article, date: null }
        const date = extractDateFromHtml(html)
        return { article, date }
      })
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        failed++
        continue
      }
      const { article, date } = result.value
      if (date) {
        await db.article.update({
          where: { id: article.id },
          data: { publishedAt: date },
        })
        updated++
      } else {
        noDate++
      }
    }

    if (i + BATCH_SIZE < articles.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nScrape complete:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  No date found: ${noDate}`)
  console.log(`  Failed: ${failed}`)

  // Use fetchedAt as fallback for remaining null articles
  const remaining = await db.article.count({ where: { publishedAt: null } })
  if (remaining > 0) {
    console.log(`\n${remaining} articles still have no date.`)
    console.log(`Setting publishedAt = fetchedAt for these as a fallback...`)
    // Raw SQL since Prisma doesn't support column-to-column assignment easily
    await db.$executeRaw`UPDATE "Article" SET "publishedAt" = "fetchedAt" WHERE "publishedAt" IS NULL`
    console.log(`Done — all articles now have dates.`)
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
