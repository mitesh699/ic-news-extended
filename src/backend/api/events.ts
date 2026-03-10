import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const events = new Hono()

interface SSEClient {
  id: string
  send: (event: string, data: string) => void
}

const clients = new Set<SSEClient>()

export function broadcastSSE(event: string, data: Record<string, unknown>): void {
  const json = JSON.stringify(data)
  for (const client of clients) {
    try {
      client.send(event, json)
    } catch {
      clients.delete(client)
    }
  }
}

events.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const clientId = crypto.randomUUID()
    const client: SSEClient = {
      id: clientId,
      send: (event, data) => {
        void stream.writeSSE({ event, data, id: clientId })
      },
    }
    clients.add(client)
    console.log(`[sse] Client connected (${clients.size} total)`)

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        void stream.writeSSE({ event: 'ping', data: '', id: clientId })
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

    // Keep stream open indefinitely
    await new Promise(() => {})
  })
})

export default events
