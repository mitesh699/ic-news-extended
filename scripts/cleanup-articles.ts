import 'dotenv/config'
import { db } from '../src/backend/db/client'

const DRY_RUN = process.argv.includes('--dry-run')

// URL patterns that indicate non-article content
const IRRELEVANT_URL_PATTERNS: RegExp[] = [
  // Social media profiles
  /instagram\.com\/[^/]+\/?$/i,
  /twitter\.com\/[^/]+\/?$/i,
  /x\.com\/[^/]+\/?$/i,
  /facebook\.com\/[^/]+\/?$/i,

  // Stock quote pages
  /finance\.yahoo\.com\/quote\b/i,
  /google\.com\/finance\b/i,

  // Company homepages (domain root with no meaningful path)
  /^https?:\/\/[^/]+\/?$/i,
  /^https?:\/\/[^/]+\/?(index\.html?)?\s*$/i,

  // Wiki / educational / learn pages
  /\/learn\//i,
  /\/wiki\//i,
  /\/what-is-/i,
  /wikipedia\.org/i,

  // About / contact / careers / pricing / login
  /\/(about|about-us|contact|careers|team|pricing|signup|sign-up|login|register|faq)\b/i,

  // GitHub repos (not news)
  /github\.com\/[^/]+\/[^/]+\/?$/i,
  /github\.com\/[^/]+\/[^/]+\/(issues|wiki|pull|tree|blob)\b/i,

  // App store listings
  /apps\.apple\.com/i,
  /play\.google\.com/i,

  // LinkedIn company profiles
  /linkedin\.com\/company\//i,

  // Non-article URL path segments
  /\/(app|apps|profile|user|company|people|jobs)\b/i,

  // Job boards
  /greenhouse\.io/i,
  /lever\.co\/[^/]+\/?$/i,
  /boards\.greenhouse/i,
  /jobs\.lever\.co/i,

  // YouTube channels (not watch pages)
  /youtube\.com\/@/i,
  /youtube\.com\/(channel|c|user)\//i,

  // Directory / listing sites
  /incubatorlist\.com/i,
  /crunchbase\.com/i,
  /ebay\.(com|co\.uk)/i,

  // Marketing pages with known patterns
  /\/(how-we-help|how-it-works|solutions|features|platform|products)\/?$/i,
]

// Title patterns that indicate non-article content
const IRRELEVANT_TITLE_PATTERNS: RegExp[] = [
  // Social media profile titles
  /• Instagram/i,
  /on X\b/i,
  /\| LinkedIn/i,

  // Stock quote page titles
  /Stock Price/i,
  /Stock Quote/i,
  /\(COIN\)/i,
  /NYSE:/i,
  /NASDAQ:/i,

  // Product marketing titles
  /Buy and Sell/i,
  /Sign Up/i,
  /Get Started/i,
  /\bDownload\b/i,

  // Job board titles
  /^Jobs at\b/i,
  /\bCareers\s*[\|&]/i,
  /\bCareers\s*$/i,
  /\bApply Now\b/i,
  /\bJoin Our Team\b/i,
  /\bWe'?re Hiring\b/i,

  // Product taglines / homepages (not news)
  /^[^:]+:\s+[A-Z#].{0,60}$/,  // "CompanyName: Short tagline" pattern
  /\ball-in-one\b/i,
  /\bAPI-connected\b.*\binfrastructure\b/i,
  /\bBring Science to\b/i,
  /\bSimplify\b.*\bManagement\b/i,
  /\bPowering Your\b/i,
  /\bfor small business\b/i,

  // Directory / listing sites
  /\bincubatorlist\b/i,
  /\bcrunchbase\b/i,
]

function isIrrelevantUrl(url: string): boolean {
  return IRRELEVANT_URL_PATTERNS.some(p => p.test(url))
}

function isIrrelevantTitle(title: string): boolean {
  const wordCount = title.replace(/[^a-z0-9\s]/gi, '').trim().split(/\s+/).filter(Boolean).length
  if (wordCount <= 2) return true

  return IRRELEVANT_TITLE_PATTERNS.some(p => p.test(title))
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE DELETE'}`)
  console.log('---')

  const allArticles = await db.article.findMany({
    select: { id: true, title: true, url: true },
  })

  console.log(`Total articles in database: ${allArticles.length}`)

  const toDelete = allArticles.filter(a => isIrrelevantUrl(a.url) || isIrrelevantTitle(a.title))

  console.log(`Articles matching cleanup patterns: ${toDelete.length}`)
  console.log('---')

  for (const article of toDelete) {
    console.log(`  [DELETE] ${article.title}`)
    console.log(`           ${article.url}`)
  }

  if (toDelete.length === 0) {
    console.log('Nothing to clean up.')
    return
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete. ${toDelete.length} articles would be deleted.`)
    return
  }

  const ids = toDelete.map(a => a.id)
  const result = await db.article.deleteMany({
    where: { id: { in: ids } },
  })

  console.log(`\nDeleted ${result.count} articles.`)
}

main()
  .catch(e => {
    console.error('Cleanup failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
