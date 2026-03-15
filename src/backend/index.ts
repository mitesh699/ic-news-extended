import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { timeout } from 'hono/timeout'
import { requestId } from 'hono/request-id'
import { HTTPException } from 'hono/http-exception'
import cron from 'node-cron'
import dotenv from 'dotenv'

dotenv.config()

const required = ['DATABASE_URL', 'ANTHROPIC_API_KEY'] as const
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

import health from './api/health'
import companies from './api/companies'
import competitorsApi from './api/competitors'
import sectorsApi from './api/sectors'
import refresh from './api/refresh'
import chat from './api/chat'
import webhooks from './api/webhooks'
import newsletterApi from './api/newsletter'
import analyticsApi from './api/analytics'
import events, { broadcastSSE } from './api/events'
import reportsApi from './api/reports'
import { rateLimiter } from './middleware/rate-limit'
import { fetchNewsForAllCompanies } from './services/news'
import { generateSummariesForAll } from './services/summaries'
import { fetchNewsForAllCompetitors } from './services/competitors'
import { generateAllSectorBriefs } from './services/sector-briefs'
import { dispatchWebhooks } from './services/webhooks'
import { sendDailySlackDigest } from './services/slack-digest'
import { sendWeeklyNewsletter, sendDailyDigestEmail } from './services/newsletter'
import { getRedisConnection, getQueue } from './jobs/queue'
import { initScheduler } from './jobs/scheduler'

const app = new Hono()

// Request ID for audit tracing
app.use('*', requestId())

// Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy)
app.use(
  '*',
  secureHeaders({
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  })
)

// Request logging
app.use('*', logger())

// Body size limit — 50KB max
app.use('/api/*', bodyLimit({ maxSize: 50 * 1024 }))

// Request timeouts — specific routes before wildcard
app.use(
  '/api/refresh',
  timeout(300_000, new HTTPException(408, { message: 'Pipeline timeout' }))
)
app.use(
  '/api/chat',
  timeout(120_000, new HTTPException(504, { message: 'Chat timeout' }))
)
app.use(
  '/api/reports',
  timeout(60_000, new HTTPException(504, { message: 'Report generation timeout' }))
)
app.use('/api/*', timeout(30_000))

// CORS — allow known frontend origins
const origins = ['http://localhost:8080']
const frontendUrl = process.env.FRONTEND_URL?.trim()
if (frontendUrl && /^https?:\/\//.test(frontendUrl)) {
  origins.push(frontendUrl)
}
console.log('CORS allowed origins:', origins)
app.use(
  '/api/*',
  cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Refresh-Token'],
    credentials: true,
  })
)

// CSRF origin validation on mutation endpoints only
app.use('/api/refresh', csrf({ origin: origins }))
app.use('/api/chat', csrf({ origin: origins }))

// Rate limiting
app.use('/api/chat', rateLimiter({ windowMs: 60_000, max: 10 }))
app.use('/api/companies', rateLimiter({ windowMs: 60_000, max: 60 }))
app.use('/api/sectors', rateLimiter({ windowMs: 60_000, max: 30 }))
app.use('/api/newsletter', rateLimiter({ windowMs: 60_000, max: 5 }))
app.use('/api/refresh', rateLimiter({ windowMs: 600_000, max: 2 }))
app.use('/api/reports', rateLimiter({ windowMs: 60_000, max: 2 }))

// Routes
app.route('/api/health', health)
app.route('/api/companies', companies)
app.route('/api/companies', competitorsApi)
app.route('/api/sectors', sectorsApi)
app.route('/api/refresh', refresh)
app.route('/api/chat', chat)
app.route('/api/webhooks', webhooks)
app.route('/api/newsletter', newsletterApi)
app.route('/api/analytics', analyticsApi)
app.route('/api/events', events)
app.route('/api/reports', reportsApi)

// Root — minimal response, no version info
app.get('/', (c) => c.json({ status: 'ok' }))

// Job queue status endpoint
app.get('/api/jobs/status', async (c) => {
  const queue = getQueue()
  if (!queue) {
    return c.json({ enabled: false, message: 'BullMQ not available — using node-cron fallback' })
  }
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ])
  return c.json({ enabled: true, waiting, active, completed, failed })
})

async function startScheduler() {
  const redisConn = getRedisConnection()

  if (redisConn) {
    const ok = await initScheduler()
    if (ok) {
      console.log('Scheduler: BullMQ with Redis')
      return
    }
    console.warn('BullMQ init failed — falling back to node-cron')
  }

  // Fallback: node-cron
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Starting scheduled news refresh...')
    try {
      const newsResult = await fetchNewsForAllCompanies()
      console.log(`[cron] Fetched ${newsResult.total} articles`)
      const summaryResult = await generateSummariesForAll()
      console.log(`[cron] Generated ${summaryResult.generated} summaries`)

      const compResult = await fetchNewsForAllCompetitors()
      console.log(`[cron] Competitor articles: ${compResult.total} from ${compResult.processed} competitors`)
      const sectorResult = await generateAllSectorBriefs()
      console.log(`[cron] Sector briefs: ${sectorResult.generated} generated, ${sectorResult.skipped} skipped`)

      if (newsResult.total > 0) {
        const payload = { totalNewArticles: newsResult.total, perCompany: newsResult.perCompany }
        dispatchWebhooks('articles.new', payload)
        broadcastSSE('articles.new', { totalNewArticles: newsResult.total, timestamp: new Date().toISOString() })
      }
    } catch (err) {
      console.error('[cron] Scheduled refresh failed:', err instanceof Error ? err.message : String(err))
    }
  })
  console.log('Cron: news refresh scheduled every 6 hours')

  let slackRunning = false
  let dailyDigestRunning = false
  let newsletterRunning = false

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_DIGEST_CHANNEL_ID) {
    cron.schedule('0 9 * * *', async () => {
      if (slackRunning) return
      slackRunning = true
      try {
        console.log('[cron] Sending daily Slack digest...')
        const result = await sendDailySlackDigest()
        console.log(`[cron] Slack digest: ${result.sent ? 'sent' : result.error}`)
      } catch (err) {
        console.error('[cron] Slack digest failed:', err instanceof Error ? err.message : String(err))
      } finally {
        slackRunning = false
      }
    }, { timezone: 'America/New_York' })
    console.log('Cron: daily Slack digest scheduled (9am ET)')
  }

  if (process.env.RESEND_API_KEY) {
    cron.schedule('5 9 * * *', async () => {
      if (dailyDigestRunning) return
      dailyDigestRunning = true
      try {
        console.log('[cron] Sending daily digest email...')
        const result = await sendDailyDigestEmail()
        console.log(`[cron] Daily digest: sent to ${result.sent} subscribers`)
      } catch (err) {
        console.error('[cron] Daily digest failed:', err instanceof Error ? err.message : String(err))
      } finally {
        dailyDigestRunning = false
      }
    }, { timezone: 'America/New_York' })
    console.log('Cron: daily digest email scheduled (9:05am ET)')
  }

  if (process.env.RESEND_API_KEY) {
    cron.schedule('0 8 * * 1', async () => {
      if (newsletterRunning) return
      newsletterRunning = true
      try {
        console.log('[cron] Sending weekly newsletter...')
        const result = await sendWeeklyNewsletter()
        console.log(`[cron] Newsletter: sent to ${result.sent} subscribers`)
      } catch (err) {
        console.error('[cron] Newsletter failed:', err instanceof Error ? err.message : String(err))
      } finally {
        newsletterRunning = false
      }
    }, { timezone: 'America/New_York' })
    console.log('Cron: weekly newsletter scheduled (Monday 8am ET)')
  }
}

startScheduler().catch((err) => {
  console.error('Scheduler init error:', err instanceof Error ? err.message : String(err))
})

const port = parseInt(process.env.PORT || '8000', 10)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

export default app
