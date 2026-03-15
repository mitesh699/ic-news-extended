import { Queue, Worker, type ConnectionOptions, type Processor } from 'bullmq'

const QUEUE_NAME = 'portfolio-pipeline'

function parseRedisUrl(url: string): ConnectionOptions | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') return null
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    }
  } catch {
    return null
  }
}

let connection: ConnectionOptions | null = null
let queue: Queue | null = null

export function getRedisConnection(): ConnectionOptions | null {
  if (connection) return connection
  const url = process.env.REDIS_URL
  if (!url) return null
  connection = parseRedisUrl(url)
  return connection
}

export function getQueue(): Queue | null {
  if (queue) return queue
  const conn = getRedisConnection()
  if (!conn) return null
  queue = new Queue(QUEUE_NAME, { connection: conn })
  return queue
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  opts: { concurrency?: number } = {}
): Worker<T> | null {
  const conn = getRedisConnection()
  if (!conn) return null
  return new Worker<T>(QUEUE_NAME, processor, {
    connection: conn,
    concurrency: opts.concurrency ?? 1,
    limiter: undefined,
  })
}

export { QUEUE_NAME }
