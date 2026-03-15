import { db } from '../db/client'
import { parseJsonResponse } from '../utils/parse-json'

export async function sendDailySlackDigest(): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_DIGEST_CHANNEL_ID
  if (!token || !channel) {
    return { sent: false, error: 'SLACK_BOT_TOKEN or SLACK_DIGEST_CHANNEL_ID not configured' }
  }

  const since = new Date()
  since.setDate(since.getDate() - 1)

  const [articles, summaries] = await Promise.all([
    db.article.findMany({
      where: { fetchedAt: { gte: since } },
      include: { company: { select: { name: true } } },
      orderBy: { fetchedAt: 'desc' },
    }),
    db.summary.findMany({
      where: { generatedAt: { gte: since } },
      select: { metadata: true, company: { select: { name: true } } },
    }),
  ])

  if (articles.length === 0) {
    return { sent: false, error: 'No articles in the last 24 hours' }
  }

  // Build signal summary
  const breaking = articles.filter(a => a.isBreaking)
  const negative = articles.filter(a => a.sentiment === 'negative')
  const positive = articles.filter(a => a.sentiment === 'positive')

  // Extract event signals from summaries
  const signals: string[] = []
  for (const s of summaries) {
    if (!s.metadata) continue
    const meta = parseJsonResponse<{ signals?: string[] }>(s.metadata, {})
    if (meta.signals) {
      for (const sig of meta.signals) {
        signals.push(`${s.company.name}: ${sig}`)
      }
    }
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // Build Slack message blocks
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Portfolio Pulse — ${dateStr}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${articles.length}* new articles · *${positive.length}* positive · *${negative.length}* negative · *${breaking.length}* breaking`,
      },
    },
  ]

  // Breaking news
  if (breaking.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Breaking*\n' + breaking.slice(0, 5).map(a =>
          `• *${a.company.name}*: ${a.title}`
        ).join('\n'),
      },
    })
  }

  // Top signals
  if (signals.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Signals*\n' + signals.slice(0, 5).map(s => `• ${s}`).join('\n'),
      },
    })
  }

  // Negative alerts
  if (negative.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Watch*\n' + negative.slice(0, 3).map(a =>
          `• ${a.company.name}: ${a.title}`
        ).join('\n'),
      },
    })
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, blocks }),
    })

    const data = await res.json() as { ok: boolean; error?: string }
    if (!data.ok) {
      console.error('[slack] Post failed:', data.error)
      return { sent: false, error: data.error }
    }
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[slack] Request failed:', msg)
    return { sent: false, error: msg }
  }
}
