import { marked } from 'marked'
import { db } from '../db/client'
import { portfolioAgent } from '../agents/portfolio'
import type { CoreMessage } from '@mastra/core/llm'

const EMAIL_STYLES = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #f8fafc; }
  .wrapper { background: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0; }
  h1 { font-size: 22px; color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 24px; }
  h2 { font-size: 17px; color: #1e40af; margin-top: 32px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  h3 { font-size: 14px; color: #334155; margin-top: 20px; }
  p { font-size: 14px; line-height: 1.6; color: #475569; margin: 8px 0; }
  ul, ol { padding-left: 20px; margin: 8px 0; }
  li { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #475569; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  strong { color: #0f172a; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  a { color: #2563eb; text-decoration: none; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
`

function markdownToEmailHtml(md: string): string {
  const bodyHtml = marked.parse(md, { async: false }) as string

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
${EMAIL_STYLES}
</head><body>
<div class="wrapper">
${bodyHtml}
</div>
<div class="footer">
  Initialized Capital Portfolio Intelligence<br>
  You're receiving this because you subscribed to the weekly digest.
</div>
</body></html>`
}

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
      content: 'Draft the weekly portfolio newsletter using draft_newsletter. Return the full newsletter content in markdown with sections for top signals, company briefs, sector trends, and risk flags. Use markdown tables where appropriate. Do NOT wrap in HTML — return clean markdown only.',
    },
  ]

  let html: string
  try {
    const result = await portfolioAgent.generate(messages, { maxSteps: 5 })
    const text = await result.text

    if (!text || text.length < 50) {
      return { sent: 0, error: 'Agent returned empty content' }
    }

    // If agent returned HTML despite instructions, strip the wrapping and extract content
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      const content = bodyMatch ? bodyMatch[1] : text.replace(/<[^>]+>/g, '')
      html = markdownToEmailHtml(content)
    } else {
      html = markdownToEmailHtml(text)
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
