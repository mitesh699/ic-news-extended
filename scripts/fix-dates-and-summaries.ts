import dotenv from 'dotenv'
dotenv.config()

import { db } from '../src/backend/db/client'
import { generateSummariesForAll } from '../src/backend/services/summaries'

async function main() {
  // Step 1: Fix articles with fake publishedAt dates
  // Articles fetched via Exa without real dates got new Date() (fetch time)
  // Detect them: articles where publishedAt is within 5 minutes of fetchedAt
  const articles = await db.article.findMany({
    where: { publishedAt: { not: null } },
    select: { id: true, publishedAt: true, fetchedAt: true },
  })

  let fixedCount = 0
  for (const a of articles) {
    if (!a.publishedAt || !a.fetchedAt) continue
    const diff = Math.abs(a.publishedAt.getTime() - a.fetchedAt.getTime())
    if (diff < 5 * 60 * 1000) {
      await db.article.update({
        where: { id: a.id },
        data: { publishedAt: null },
      })
      fixedCount++
    }
  }
  console.log(`Fixed ${fixedCount} articles with fake publishedAt dates (set to null)`)

  // Step 2: Delete all existing summaries to force regeneration
  const deleted = await db.summary.deleteMany({})
  console.log(`Deleted ${deleted.count} old summaries`)

  // Step 3: Regenerate summaries for all companies
  console.log('Regenerating AI summaries for all companies...')
  const result = await generateSummariesForAll()
  console.log(`Done. Generated: ${result.generated}, Skipped: ${result.skipped}`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
