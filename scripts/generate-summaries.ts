import dotenv from 'dotenv'
dotenv.config()

import { generateSummariesForAll } from '../src/backend/services/summaries'

async function main() {
  console.log('Generating AI summaries for all companies...')
  const result = await generateSummariesForAll()
  console.log(`\nDone. Generated: ${result.generated}, Skipped: ${result.skipped}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
