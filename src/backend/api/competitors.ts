import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client'
import { requireRefreshToken } from '../middleware/auth'
import {
  addCompetitor,
  removeCompetitor,
  getCompetitorsForCompany,
  fetchNewsForCompetitor,
  fetchNewsForAllCompetitors,
} from '../services/competitors'

const competitors = new Hono()

// GET /api/companies/:companyId/competitors
competitors.get('/:companyId/competitors', async (c) => {
  const companyId = c.req.param('companyId')
  if (!z.string().cuid().safeParse(companyId).success) {
    return c.json({ error: 'Invalid company ID', code: 'VALIDATION_ERROR' }, 400)
  }

  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) {
    return c.json({ error: 'Company not found', code: 'NOT_FOUND' }, 404)
  }

  const data = await getCompetitorsForCompany(companyId)
  return c.json(data.map(serializeCompetitor))
})

// POST /api/companies/:companyId/competitors — requires auth
const addSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional(),
  description: z.string().max(500).optional(),
  sector: z.string().max(100).optional(),
  relevance: z.enum(['direct', 'indirect']).optional(),
})

competitors.post('/:companyId/competitors', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const companyId = c.req.param('companyId')
  if (!z.string().cuid().safeParse(companyId).success) {
    return c.json({ error: 'Invalid company ID', code: 'VALIDATION_ERROR' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', code: 'VALIDATION_ERROR' }, 400)
  }

  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } })
  if (!company) {
    return c.json({ error: 'Company not found', code: 'NOT_FOUND' }, 404)
  }

  try {
    const competitor = await addCompetitor(companyId, parsed.data.name, parsed.data)
    return c.json(competitor, 201)
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return c.json({ error: 'Competitor already exists for this company', code: 'CONFLICT' }, 409)
    }
    throw err
  }
})

// DELETE /api/competitors/:id — requires auth
competitors.delete('/competitors/:id', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const id = c.req.param('id')
  try {
    await removeCompetitor(id)
    return c.json({ deleted: true })
  } catch {
    return c.json({ error: 'Competitor not found', code: 'NOT_FOUND' }, 404)
  }
})

// POST /api/competitors/:id/fetch — fetch news for one competitor
competitors.post('/competitors/:id/fetch', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const id = c.req.param('id')
  const count = await fetchNewsForCompetitor(id)
  return c.json({ articlesFound: count })
})

// POST /api/competitors/fetch-all — fetch news for all competitors
competitors.post('/competitors/fetch-all', async (c) => {
  if (!requireRefreshToken(c)) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const result = await fetchNewsForAllCompetitors()
  return c.json(result)
})

function serializeCompetitor(comp: {
  id: string
  name: string
  website: string | null
  logoUrl: string | null
  description: string | null
  sector: string | null
  relevance: string
  createdAt: Date
  articles: { id: string; title: string; url: string; source: string | null; sourceName: string | null; summary: string | null; sentiment: string | null; signal: string | null; publishedAt: Date | null; fetchedAt: Date }[]
}) {
  return {
    id: comp.id,
    name: comp.name,
    website: comp.website,
    logo: comp.logoUrl,
    description: comp.description,
    sector: comp.sector,
    relevance: comp.relevance,
    createdAt: comp.createdAt.toISOString(),
    articles: comp.articles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source ?? '',
      sourceName: a.sourceName ?? '',
      summary: a.summary,
      sentiment: a.sentiment,
      signal: a.signal,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      fetchedAt: a.fetchedAt.toISOString(),
    })),
  }
}

export default competitors
