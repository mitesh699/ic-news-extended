import dotenv from 'dotenv'
dotenv.config()

import { fetchNewsForAllCompanies } from '../src/backend/services/news'

async function main() {
  console.log('Fetching news for all companies...')
  const result = await fetchNewsForAllCompanies()
  console.log(`\nDone. ${result.total} total new articles`)
  console.log('Per company:', JSON.stringify(result.perCompany, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
