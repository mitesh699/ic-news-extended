import dotenv from 'dotenv'
dotenv.config()

import Exa from 'exa-js'
import { db } from '../src/backend/db/client'

const BATCH_SIZE = 50 // Exa getContents supports up to 100 URLs per call
const DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    console.error('EXA_API_KEY not set')
    process.exit(1)
  }

  const exa = new Exa(apiKey)

  // Get all articles with null publishedAt
  const articles = await db.article.findMany({
    where: { publishedAt: null },
    select: { id: true, url: true, title: true },
  })

  console.log(`Found ${articles.length} articles with null publishedAt`)
  if (articles.length === 0) {
    process.exit(0)
  }

  let updated = 0
  let failed = 0
  let noDate = 0

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    const urls = batch.map((a) => a.url)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE)

    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} URLs...`)

    try {
      const result = await exa.getContents(urls, {})

      // Map results by URL for lookup
      const byUrl = new Map<string, string>()
      for (const r of result.results) {
        if (r.publishedDate && r.url) {
          byUrl.set(r.url, r.publishedDate)
        }
      }

      // Update articles that got dates
      for (const article of batch) {
        const pubDate = byUrl.get(article.url)
        if (pubDate) {
          try {
            const parsed = new Date(pubDate)
            if (!isNaN(parsed.getTime())) {
              await db.article.update({
                where: { id: article.id },
                data: { publishedAt: parsed },
              })
              updated++
            } else {
              noDate++
            }
          } catch {
            noDate++
          }
        } else {
          noDate++
        }
      }
    } catch (err) {
      console.error(`  Batch failed:`, err instanceof Error ? err.message : String(err))
      failed += batch.length
    }

    if (i + BATCH_SIZE < articles.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nBackfill complete:`)
  console.log(`  Updated: ${updated}`)
  console.log(`  No date found: ${noDate}`)
  console.log(`  Failed: ${failed}`)

  // Step 2: Clear isBreaking on articles older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
  const staleBreaking = await db.article.updateMany({
    where: {
      isBreaking: true,
      OR: [
        { publishedAt: { lt: sevenDaysAgo } },
        { publishedAt: null, fetchedAt: { lt: sevenDaysAgo } },
      ],
    },
    data: { isBreaking: false },
  })
  console.log(`  Cleared isBreaking on ${staleBreaking.count} old articles`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
