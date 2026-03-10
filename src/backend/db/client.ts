import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL not set')

  const pool = new pg.Pool({
    connectionString: raw,
    ssl: process.env.NODE_ENV === 'production' ? true : { rejectUnauthorized: false },
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

let _db: PrismaClient | null = null
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!_db) _db = createClient()
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  },
})
