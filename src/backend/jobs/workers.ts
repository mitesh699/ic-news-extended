import type { Job } from 'bullmq'
import { createWorker } from './queue'
import { fetchNewsForAllCompanies } from '../services/news'
import { generateSummariesForAll } from '../services/summaries'
import { fetchNewsForAllCompetitors } from '../services/competitors'
import { generateAllSectorBriefs } from '../services/sector-briefs'
import { sendDailySlackDigest } from '../services/slack-digest'
import { sendWeeklyNewsletter } from '../services/newsletter'
import { dispatchWebhooks } from '../services/webhooks'
import { broadcastSSE } from '../api/events'

type JobName =
  | 'refresh-news'
  | 'generate-summaries'
  | 'refresh-competitors'
  | 'generate-briefs'
  | 'send-slack-digest'
  | 'send-newsletter'

interface JobData {
  type: JobName
}

async function processJob(job: Job<JobData>): Promise<void> {
  const { type } = job.data
  console.log(`[bullmq] Processing job: ${type} (${job.id})`)

  switch (type) {
    case 'refresh-news': {
      const result = await fetchNewsForAllCompanies()
      console.log(`[bullmq] Fetched ${result.total} articles`)
      if (result.total > 0) {
        dispatchWebhooks('articles.new', { totalNewArticles: result.total, perCompany: result.perCompany })
        broadcastSSE('articles.new', { totalNewArticles: result.total, timestamp: new Date().toISOString() })
      }
      break
    }
    case 'generate-summaries': {
      const result = await generateSummariesForAll()
      console.log(`[bullmq] Generated ${result.generated} summaries`)
      break
    }
    case 'refresh-competitors': {
      const result = await fetchNewsForAllCompetitors()
      console.log(`[bullmq] Competitor articles: ${result.total} from ${result.processed} competitors`)
      break
    }
    case 'generate-briefs': {
      const result = await generateAllSectorBriefs()
      console.log(`[bullmq] Sector briefs: ${result.generated} generated, ${result.skipped} skipped`)
      break
    }
    case 'send-slack-digest': {
      const result = await sendDailySlackDigest()
      console.log(`[bullmq] Slack digest: ${result.sent ? 'sent' : result.error}`)
      break
    }
    case 'send-newsletter': {
      const result = await sendWeeklyNewsletter()
      console.log(`[bullmq] Newsletter: sent to ${result.sent} subscribers`)
      break
    }
  }
}

export function initWorkers(): boolean {
  const worker = createWorker<JobData>('portfolio-worker', processJob, { concurrency: 1 })
  if (!worker) return false

  worker.on('completed', (job) => {
    console.log(`[bullmq] Job completed: ${job.data.type} (${job.id})`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[bullmq] Job failed: ${job?.data.type} (${job?.id}):`, err.message)
  })

  console.log('BullMQ worker initialized')
  return true
}
