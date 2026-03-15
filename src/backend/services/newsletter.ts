import { db } from '../db/client'
import { portfolioAgent } from '../agents/portfolio'
import type { CoreMessage } from '@mastra/core/llm'

export async function sendWeeklyNewsletter(): Promise<{ sent: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  if (!apiKey) return { sent: 0, error: 'RESEND_API_KEY not configured' }

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { active: true, frequency: 'weekly' },
    select: { email: true },
  })

  if (subscribers.length === 0) {
    console.log('[newsletter] No active weekly subscribers')
    return { sent: 0, error: 'No subscribers' }
  }

  // Generate newsletter via agent
  console.log('[newsletter] Generating newsletter via agent...')
  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: 'Draft the weekly portfolio newsletter. Use draft_newsletter to get the data, then create_report to format it as HTML. Return just the HTML content.',
    },
  ]

  let html: string
  try {
    const result = await portfolioAgent.generate(messages, { maxSteps: 5 })
    const text = await result.text

    // If agent returned HTML, use it directly. Otherwise wrap in basic HTML
    if (text.includes('<html') || text.includes('<body') || text.includes('<table')) {
      html = text
    } else {
      html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; }
h1 { font-size: 22px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
h2 { font-size: 16px; margin-top: 24px; color: #334155; }
ul { padding-left: 20px; }
li { margin-bottom: 4px; }
</style></head><body>
${text.replace(/\n/g, '<br>')}
</body></html>`
    }
  } catch (err) {
    console.error('[newsletter] Agent failed:', err instanceof Error ? err.message : String(err))
    return { sent: 0, error: 'Agent generation failed' }
  }

  // Send via Resend batch (max 100 per call)
  const dateStr = new Date().toISOString().slice(0, 10)
  const subject = `Initialized Portfolio Weekly — ${dateStr}`
  let totalSent = 0

  for (let i = 0; i < subscribers.length; i += 100) {
    const batch = subscribers.slice(i, i + 100)
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
          batch.map(s => ({ from, to: s.email, subject, html }))
        ),
      })

      if (res.ok) {
        totalSent += batch.length
      } else {
        const body = await res.text()
        console.error(`[newsletter] Resend batch error: ${res.status} ${body}`)
      }
    } catch (err) {
      console.error('[newsletter] Resend request failed:', err instanceof Error ? err.message : String(err))
    }
  }

  console.log(`[newsletter] Sent to ${totalSent}/${subscribers.length} subscribers`)
  return { sent: totalSent }
}
