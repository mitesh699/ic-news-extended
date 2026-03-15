import { getQueue } from './queue'
import { initWorkers } from './workers'

interface SchedulerEntry {
  id: string
  pattern: string
  tz?: string
  jobData: { type: string }
}

const SCHEDULES: SchedulerEntry[] = [
  { id: 'refresh-news', pattern: '0 */6 * * *', jobData: { type: 'refresh-news' } },
  { id: 'generate-summaries', pattern: '10 */6 * * *', jobData: { type: 'generate-summaries' } },
  { id: 'refresh-competitors', pattern: '20 */6 * * *', jobData: { type: 'refresh-competitors' } },
  { id: 'generate-briefs', pattern: '30 */6 * * *', jobData: { type: 'generate-briefs' } },
  { id: 'send-slack-digest', pattern: '0 9 * * *', tz: 'America/New_York', jobData: { type: 'send-slack-digest' } },
  { id: 'send-newsletter', pattern: '0 8 * * 1', tz: 'America/New_York', jobData: { type: 'send-newsletter' } },
]

export async function initScheduler(): Promise<boolean> {
  const queue = getQueue()
  if (!queue) return false

  if (!initWorkers()) return false

  for (const entry of SCHEDULES) {
    await queue.upsertJobScheduler(
      entry.id,
      { pattern: entry.pattern, tz: entry.tz },
      { data: entry.jobData }
    )
  }

  console.log('BullMQ scheduler initialized with repeatable jobs')
  return true
}
