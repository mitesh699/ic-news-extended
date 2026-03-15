#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const SLACK_API = 'https://slack.com/api'

async function slackApi(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN not set')

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as Record<string, unknown>
  if (!data.ok) throw new Error(`Slack API ${method}: ${data.error}`)
  return data
}

async function slackGet(method: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN not set')

  const qs = new URLSearchParams(params).toString()
  const url = `${SLACK_API}/${method}${qs ? `?${qs}` : ''}`

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  const data = await res.json() as Record<string, unknown>
  if (!data.ok) throw new Error(`Slack API ${method}: ${data.error}`)
  return data
}

const server = new McpServer({
  name: 'slack',
  version: '1.0.0',
})

server.tool(
  'post_message',
  'Post a message to a Slack channel. Supports mrkdwn formatting (*bold*, _italic_, `code`, bullet points).',
  {
    channel: z.string().describe('Channel ID (e.g. C0ALLSJPQDC) or channel name'),
    text: z.string().describe('Message text in Slack mrkdwn format'),
  },
  async ({ channel, text }) => {
    const data = await slackApi('chat.postMessage', { channel, text })
    return {
      content: [{ type: 'text' as const, text: `Message posted (ts: ${data.ts})` }],
    }
  }
)

server.tool(
  'list_channels',
  'List public Slack channels in the workspace.',
  {
    limit: z.number().min(1).max(200).default(20).describe('Max channels to return'),
  },
  async ({ limit }) => {
    const data = await slackGet('conversations.list', {
      types: 'public_channel',
      limit: String(limit),
      exclude_archived: 'true',
    })
    const channels = data.channels as { id: string; name: string; num_members: number }[]
    const list = channels.map(c => `#${c.name} (${c.id}) — ${c.num_members} members`).join('\n')
    return {
      content: [{ type: 'text' as const, text: list || 'No channels found' }],
    }
  }
)

server.tool(
  'get_channel_history',
  'Get recent messages from a Slack channel.',
  {
    channel: z.string().describe('Channel ID'),
    limit: z.number().min(1).max(50).default(10).describe('Number of messages'),
  },
  async ({ channel, limit }) => {
    const data = await slackGet('conversations.history', {
      channel,
      limit: String(limit),
    })
    const messages = data.messages as { text: string; user?: string; ts: string }[]
    const formatted = messages.map(m => {
      const time = new Date(parseFloat(m.ts) * 1000).toISOString().slice(0, 16)
      return `[${time}] ${m.user ?? 'bot'}: ${m.text}`
    }).join('\n')
    return {
      content: [{ type: 'text' as const, text: formatted || 'No messages' }],
    }
  }
)

server.tool(
  'reply_to_thread',
  'Reply to a specific message thread in Slack.',
  {
    channel: z.string().describe('Channel ID'),
    thread_ts: z.string().describe('Thread timestamp to reply to'),
    text: z.string().describe('Reply text'),
  },
  async ({ channel, thread_ts, text }) => {
    const data = await slackApi('chat.postMessage', { channel, thread_ts, text })
    return {
      content: [{ type: 'text' as const, text: `Reply posted (ts: ${data.ts})` }],
    }
  }
)

server.tool(
  'add_reaction',
  'Add an emoji reaction to a message.',
  {
    channel: z.string().describe('Channel ID'),
    timestamp: z.string().describe('Message timestamp'),
    name: z.string().describe('Emoji name without colons (e.g. "thumbsup")'),
  },
  async ({ channel, timestamp, name }) => {
    await slackApi('reactions.add', { channel, timestamp, name })
    return {
      content: [{ type: 'text' as const, text: `Reaction :${name}: added` }],
    }
  }
)

server.tool(
  'search_messages',
  'Search for messages across the workspace.',
  {
    query: z.string().describe('Search query'),
    count: z.number().min(1).max(20).default(5).describe('Number of results'),
  },
  async ({ query, count }) => {
    const token = process.env.SLACK_BOT_TOKEN
    if (!token) throw new Error('SLACK_BOT_TOKEN not set')

    const qs = new URLSearchParams({ query, count: String(count) }).toString()
    const res = await fetch(`${SLACK_API}/search.messages?${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json() as Record<string, unknown>
    if (!data.ok) throw new Error(`search.messages: ${data.error}`)

    const messages = (data.messages as { matches?: { text: string; channel?: { name: string }; ts: string }[] })?.matches ?? []
    const formatted = messages.map(m => {
      const ch = m.channel?.name ?? 'unknown'
      return `#${ch}: ${m.text.slice(0, 200)}`
    }).join('\n\n')

    return {
      content: [{ type: 'text' as const, text: formatted || 'No results' }],
    }
  }
)

server.tool(
  'upload_pdf_report',
  'Generate a portfolio intelligence PDF report with charts and upload it directly to the Slack channel as a file attachment.',
  {
    channel: z.string().describe('Channel ID to upload to'),
    days_back: z.number().min(1).max(90).default(7).describe('Number of days to cover'),
    message: z.string().default('').describe('Optional message to accompany the file'),
  },
  async ({ channel, days_back, message }) => {
    // Dynamic import — this runs as a child process, so we load on demand
    const { generatePortfolioPDF } = await import('../services/pdf-report.js')
    const pdfBuffer = await generatePortfolioPDF({ daysBack: days_back })
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `portfolio-report-${dateStr}.pdf`

    const token = process.env.SLACK_BOT_TOKEN
    if (!token) throw new Error('SLACK_BOT_TOKEN not set')

    // Step 1: Get upload URL
    const getUrlRes = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`,
      },
      body: new URLSearchParams({
        filename,
        length: String(pdfBuffer.length),
      }),
    })
    const urlData = await getUrlRes.json() as { ok: boolean; upload_url?: string; file_id?: string; error?: string }
    if (!urlData.ok || !urlData.upload_url || !urlData.file_id) {
      throw new Error(`files.getUploadURLExternal: ${urlData.error ?? 'missing upload_url'}`)
    }

    // Step 2: Upload the file content
    const uploadRes = await fetch(urlData.upload_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBuffer,
    })
    if (!uploadRes.ok) {
      throw new Error(`File upload failed: ${uploadRes.status}`)
    }

    // Step 3: Complete the upload and share to channel
    const completeRes = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        files: [{ id: urlData.file_id, title: `Portfolio Report — ${dateStr}` }],
        channel_id: channel,
        initial_comment: message || `Portfolio Intelligence Report — last ${days_back} days`,
      }),
    })
    const completeData = await completeRes.json() as { ok: boolean; error?: string }
    if (!completeData.ok) {
      throw new Error(`files.completeUploadExternal: ${completeData.error}`)
    }

    return {
      content: [{ type: 'text' as const, text: `PDF report uploaded to channel (${filename}, ${(pdfBuffer.length / 1024).toFixed(0)}KB)` }],
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Use stderr — stdout is reserved for MCP JSON-RPC
  console.error('[slack-mcp] Custom Slack MCP server running on stdio')
}

main().catch((err) => {
  console.error('[slack-mcp] Fatal:', err)
  process.exit(1)
})
