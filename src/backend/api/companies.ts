import { Hono } from 'hono'
import { sValidator } from '@hono/standard-validator'
import { z } from 'zod'
import { db } from '../db/client'
import { cache } from '../utils/cache'
import { parseSummaryMeta } from '../utils/parseSummaryMeta'

const COMPANIES_CACHE_TTL = 60_000 // 60 seconds

const VALID_SIGNALS = ['positive', 'negative', 'neutral'] as const
type Signal = (typeof VALID_SIGNALS)[number]

function mapArticle(a: { id: string; title: string; source: string | null; url: string; summary: string | null; publishedAt: Date | null; fetchedAt: Date; sentiment: string | null; isBreaking: boolean | null }) {
  return {
    id: a.id,
    title: a.title,
    source: a.source ?? '',
    url: a.url,
    summary: a.summary ?? undefined,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    fetchedAt: a.fetchedAt.toISOString(),
    signal: (VALID_SIGNALS.includes(a.sentiment as Signal) ? a.sentiment : 'neutral') as Signal,
    isBreaking: a.isBreaking ?? false,
  }
}

function serializeCompany(company: { id: string; name: string; logoUrl: string | null; sector: string | null; description: string | null; lastFetchedAt: Date | null; updatedAt: Date; articles: Parameters<typeof mapArticle>[0][]; summaries: { summaryText: string; metadata: string | null }[] }) {
  return {
    id: company.id,
    name: company.name,
    logo: company.logoUrl ?? undefined,
    sector: company.sector ?? '',
    description: company.description ?? '',
    summary: company.summaries[0]?.summaryText ?? '',
    summaryMeta: parseSummaryMeta(company.summaries[0]?.metadata),
    newsArticles: company.articles.map(mapArticle),
    lastUpdated: (company.lastFetchedAt ?? company.updatedAt).toISOString(),
  }
}

const companies = new Hono()

const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  sort: z.enum(['name', 'sector', 'recent']).optional(),
})

companies.get('/', sValidator('query', listQuerySchema), async (c) => {
  const { search, sort = 'name' } = c.req.valid('query')

  const cacheKey = search ? null : `companies:${sort}`
  if (cacheKey) {
    const cached = cache.get<unknown[]>(cacheKey)
    if (cached) return c.json(cached)
  }

  const where = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {}

  const orderBy = sort === 'sector'
    ? [{ sector: 'asc' as const }, { name: 'asc' as const }]
    : sort === 'recent'
      ? [{ lastFetchedAt: 'desc' as const }]
      : [{ name: 'asc' as const }]

  const data = await db.company.findMany({
    where,
    orderBy,
    include: {
      articles: { orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }], take: 5 },
      summaries: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  })

  const result = data.map(serializeCompany)

  if (cacheKey) cache.set(cacheKey, result, COMPANIES_CACHE_TTL)
  return c.json(result)
})

companies.get('/:id', async (c) => {
  const id = c.req.param('id')
  if (!z.string().cuid().safeParse(id).success) {
    return c.json({ error: 'Invalid company ID format', code: 'VALIDATION_ERROR' }, 400)
  }

  const company = await db.company.findUnique({
    where: { id },
    include: {
      articles: { orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { fetchedAt: 'desc' }], take: 20 },
      summaries: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  })

  if (!company) {
    return c.json({ error: 'Company not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(serializeCompany(company))
})

export default companies
