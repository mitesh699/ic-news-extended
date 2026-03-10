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
import refresh from './api/refresh'
import chat from './api/chat'
import webhooks from './api/webhooks'
import events, { broadcastSSE } from './api/events'
import { rateLimiter } from './middleware/rate-limit'
import { fetchNewsForAllCompanies } from './services/news'
import { generateSummariesForAll } from './services/summaries'
import { dispatchWebhooks } from './services/webhooks'

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
app.use('/api/refresh', rateLimiter({ windowMs: 600_000, max: 2 }))

// Routes
app.route('/api/health', health)
app.route('/api/companies', companies)
app.route('/api/refresh', refresh)
app.route('/api/chat', chat)
app.route('/api/webhooks', webhooks)
app.route('/api/events', events)

// Root — minimal response, no version info
app.get('/', (c) => c.json({ status: 'ok' }))

// Auto-refresh news every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[cron] Starting scheduled news refresh...')
  try {
    const newsResult = await fetchNewsForAllCompanies()
    console.log(`[cron] Fetched ${newsResult.total} articles`)
    const summaryResult = await generateSummariesForAll()
    console.log(`[cron] Generated ${summaryResult.generated} summaries`)
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

const port = parseInt(process.env.PORT || '8000', 10)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`)
})

export default app
