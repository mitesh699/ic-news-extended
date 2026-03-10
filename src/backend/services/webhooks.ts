import { createHmac } from 'node:crypto'
import { db } from '../db/client'

interface WebhookPayload {
  event: string
  timestamp: string
  data: Record<string, unknown>
}

export function dispatchWebhooks(event: string, data: Record<string, unknown>): void {
  // Fire-and-forget — don't await
  void (async () => {
    try {
      const hooks = await db.webhook.findMany({
        where: { active: true, events: { contains: event } },
      })

      if (hooks.length === 0) return

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      }
      const body = JSON.stringify(payload)

      const results = await Promise.allSettled(
        hooks.map(async (hook) => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
          }

          if (hook.secret) {
            const signature = createHmac('sha256', hook.secret).update(body).digest('hex')
            headers['X-Webhook-Signature'] = `sha256=${signature}`
          }

          const res = await fetch(hook.url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10_000),
          })

          if (!res.ok) {
            console.warn(`[webhook] ${hook.url} responded ${res.status}`)
          }
        })
      )

      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn(`[webhook] ${failed.length}/${hooks.length} deliveries failed`)
      }
    } catch (err) {
      console.error('[webhook] Dispatch error:', err instanceof Error ? err.message : String(err))
    }
  })()
}
