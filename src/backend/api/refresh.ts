import { Hono } from 'hono'
import { z } from 'zod'
import { fetchNewsForAllCompanies, fetchNewsForCompany, parseKeywords } from '../services/news'
import { generateSummariesForAll, generateSummaryForCompany } from '../services/summaries'
import { dispatchWebhooks } from '../services/webhooks'
import { broadcastSSE } from './events'
import { cache } from '../utils/cache'
import { db } from '../db/client'
import { checkRefreshAuth } from '../middleware/auth'

const refresh = new Hono()

const companyIdSchema = z.string().cuid()

// Full pipeline refresh — all companies
refresh.post('/', async (c) => {
  if (!checkRefreshAuth(c)) {
    const secret = process.env.REFRESH_SECRET
    if (!secret) return c.json({ error: 'Endpoint not configured', code: 'NOT_CONFIGURED' }, 503)
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  // Fire-and-forget: return immediately, run pipeline in background
  // Railway's proxy timeout (30-60s) is too short for 175 companies
  const runPipeline = async () => {
    const startTime = Date.now()
    try {
      console.log('Starting full pipeline refresh...')

      const newsResult = await fetchNewsForAllCompanies()
      console.log(`News fetch complete: ${newsResult.total} new articles`)

      const summaryResult = await generateSummariesForAll()
      console.log(`Summaries: ${summaryResult.generated} generated, ${summaryResult.skipped} skipped`)

      cache.invalidate('companies')

      if (newsResult.total > 0) {
        const payload = { totalNewArticles: newsResult.total, perCompany: newsResult.perCompany }
        dispatchWebhooks('articles.new', payload)
        broadcastSSE('articles.new', { totalNewArticles: newsResult.total, timestamp: new Date().toISOString() })
      }

      const durationMs = Date.now() - startTime
      console.log(`Full refresh complete in ${(durationMs / 1000).toFixed(1)}s — ${newsResult.total} articles, ${summaryResult.generated} summaries`)
    } catch (err) {
      console.error('Refresh pipeline error:', err instanceof Error ? err.message : String(err))
    }
  }

  runPipeline()

  return c.json({ status: 'accepted', message: 'Refresh pipeline started. Updates will arrive via SSE.' })
})

// Per-company refresh — fetch latest news + regenerate summary for one company
refresh.post('/:companyId', async (c) => {
  if (!checkRefreshAuth(c)) {
    const secret = process.env.REFRESH_SECRET
    if (!secret) return c.json({ error: 'Endpoint not configured', code: 'NOT_CONFIGURED' }, 503)
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  }

  const companyId = c.req.param('companyId')
  const parsed = companyIdSchema.safeParse(companyId)
  if (!parsed.success) {
    return c.json({ error: 'Invalid companyId format', code: 'VALIDATION_ERROR' }, 400)
  }

  const startTime = Date.now()

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, keywords: true, sector: true },
  })

  if (!company) {
    return c.json({ error: 'Company not found', code: 'NOT_FOUND' }, 404)
  }

  try {
    const keywords = parseKeywords(company.keywords)

    const newArticles = await fetchNewsForCompany(
      company.id,
      company.name,
      keywords,
      company.sector || 'Technology'
    )

    const summaryGenerated = await generateSummaryForCompany(company.id)

    cache.invalidate('companies')

    if (newArticles > 0) {
      const payload = { totalNewArticles: newArticles, perCompany: { [company.name]: newArticles } }
      dispatchWebhooks('articles.new', payload)
      broadcastSSE('articles.new', {
        totalNewArticles: newArticles,
        company: company.name,
        timestamp: new Date().toISOString(),
      })
    }

    const durationMs = Date.now() - startTime

    return c.json({
      status: 'complete',
      company: company.name,
      duration: `${(durationMs / 1000).toFixed(1)}s`,
      newArticles,
      summaryGenerated,
    })
  } catch (err) {
    console.error(`Refresh error for ${company.name}:`, err instanceof Error ? err.message : String(err))
    return c.json(
      { error: 'Pipeline failed', code: 'PIPELINE_ERROR' },
      500
    )
  }
})

export default refresh
