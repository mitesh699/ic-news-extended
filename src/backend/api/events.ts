import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const events = new Hono()

interface SSEClient {
  id: string
  send: (event: string, data: string, eventId: number) => void
}

interface BufferedEvent {
  id: number
  event: string
  data: string
}

const clients = new Set<SSEClient>()

let eventCounter = 0
const EVENT_BUFFER_SIZE = 50
const eventBuffer: BufferedEvent[] = []

function nextEventId(): number {
  return ++eventCounter
}

function bufferEvent(id: number, event: string, data: string): void {
  eventBuffer.push({ id, event, data })
  if (eventBuffer.length > EVENT_BUFFER_SIZE) {
    eventBuffer.shift()
  }
}

export function broadcastSSE(event: string, data: Record<string, unknown>): void {
  const id = nextEventId()
  const json = JSON.stringify(data)
  bufferEvent(id, event, json)
  for (const client of clients) {
    try {
      client.send(event, json, id)
    } catch {
      clients.delete(client)
    }
  }
}

events.get('/', (c) => {
  const lastEventId = parseInt(c.req.header('Last-Event-ID') ?? '', 10)

  return streamSSE(c, async (stream) => {
    const clientId = crypto.randomUUID()
    const client: SSEClient = {
      id: clientId,
      send: (event, data, eventId) => {
        void stream.writeSSE({ event, data, id: String(eventId) })
      },
    }
    clients.add(client)
    console.log(`[sse] Client connected (${clients.size} total)`)

    if (!isNaN(lastEventId) && lastEventId > 0) {
      const missed = eventBuffer.filter((e) => e.id > lastEventId)
      for (const e of missed) {
        try {
          void stream.writeSSE({ event: e.event, data: e.data, id: String(e.id) })
        } catch {
          clients.delete(client)
          return
        }
      }
      console.log(`[sse] Replayed ${missed.length} missed events for client ${clientId}`)
    }

    const heartbeat = setInterval(() => {
      try {
        const hbId = nextEventId()
        bufferEvent(hbId, 'ping', '')
        void stream.writeSSE({ event: 'ping', data: '', id: String(hbId) })
      } catch {
        clearInterval(heartbeat)
        clients.delete(client)
      }
    }, 30_000)

    stream.onAbort(() => {
      clearInterval(heartbeat)
      clients.delete(client)
      console.log(`[sse] Client disconnected (${clients.size} total)`)
    })

    await new Promise(() => {})
  })
})

export default events
